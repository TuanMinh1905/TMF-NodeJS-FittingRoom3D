// ===== TMFashion – Phòng thử đồ ảo (Virtual Fitting Room) =====
//
// SMPL (Skinned Multi-Person Linear Model):
//   - Model đã train trên ~4000 bản scan 3D người thật
//   - 10 tham số β (shape) điều khiển hình dạng cơ thể
//   - Khi thay đổi β → mesh body thay đổi tương ứng đời thật
//
// Kiến trúc:
//   Frontend (Next.js + Three.js) ←→ Python SMPL Service (FastAPI:8001)
//   β[10] → Python sinh mesh (vertices + faces) → Three.js render
//
// Flow theo SD: Quản lý phòng thử đồ (User)
//   1. Nhập thông số cơ thể / điều chỉnh β trực tiếp → model 3D realtime
//   2. Chọn sản phẩm → try → AI đánh giá size
//   3. Xem lịch sử thử đồ
//
// Tech: SMPL β mapping + Three.js (React Three Fiber) + Python FastAPI + Hono backend
//
// STM Quản lý phòng thử đồ:
//   [Idle] → Nhập thông số → [Đã có body profile] → Chọn sản phẩm
//   → [Đang thử] → Nhận kết quả → [Xem kết quả] → Thử sản phẩm khác | Thoát

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { formatVNDWithComma } from "@/utils";
import {
  measurementsToSMPLBeta,
  betaToBodyScales,
  recommendSize,
  getClothingParams,
  type BodyMeasurements,
  type BodyPartScales,
  type ClothingParams,
} from "@/lib/smpl";
import type { RenderMode } from "@/components/fitting-room/FittingScene";

// Dynamic import – R3F Canvas không hoạt động khi SSR
const FittingScene = dynamic(
  () => import("@/components/fitting-room/FittingScene"),
  { ssr: false, loading: () => <ScenePlaceholder /> }
);

function ScenePlaceholder() {
  return (
    <div className="w-full min-h-[500px] rounded-xl bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Đang tải mô hình 3D...</p>
      </div>
    </div>
  );
}

// ---------- Product type ----------
interface Product {
  _id: string;
  name: string;
  image_url?: string;
  price: number;
  compare_at_price?: number;
  category?: { name: string };
}

// ---------- History ----------
interface HistoryItem {
  _id: string;
  product_id: { _id: string; name: string; image_url?: string; price?: number };
  recommended_size: string;
  fit_score: number;
  ai_comment: string;
  user_height: number;
  user_weight: number;
  created_at: string;
}

// ---------- Tabs ----------
type Tab = "measure" | "beta" | "tryon" | "history";

// ---------- β parameter descriptions ----------
const BETA_LABELS = [
  { index: 0, label: "β₀ Chiều cao", desc: "Thấp ↔ Cao",          min: -3, max: 3 },
  { index: 1, label: "β₁ Cân nặng",  desc: "Gầy ↔ Mập",           min: -3, max: 3 },
  { index: 2, label: "β₂ Vòng ngực",  desc: "Ngực nhỏ ↔ Ngực to",  min: -3, max: 3 },
  { index: 3, label: "β₃ Vòng eo",    desc: "Eo nhỏ ↔ Eo to",      min: -3, max: 3 },
  { index: 4, label: "β₄ Vòng hông",  desc: "Hông nhỏ ↔ Hông to",  min: -3, max: 3 },
  { index: 5, label: "β₅ BMI",        desc: "Mảnh ↔ Đầy đặn",      min: -3, max: 3 },
  { index: 6, label: "β₆ Ngực/Eo",    desc: "Tỷ lệ ngực–eo",       min: -2, max: 2 },
  { index: 7, label: "β₇ Hông/Eo",    desc: "Tỷ lệ hông–eo",       min: -2, max: 2 },
  { index: 8, label: "β₈ Thân trên",  desc: "Torso proportion",     min: -2, max: 2 },
  { index: 9, label: "β₉ Chi",        desc: "Tay chân mảnh ↔ to",   min: -2, max: 2 },
];

// SMPL Service URL
const SMPL_SERVICE_URL = "http://localhost:8001";

// ==================== Page Component ====================

export default function FittingRoomPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuthStore();

  // Auth guard
  useEffect(() => {
    if (!isLoggedIn) router.push("/login");
  }, [isLoggedIn, router]);

  // ---------- State ----------
  const [tab, setTab] = useState<Tab>("measure");

  // Render mode: primitive (offline) vs smpl (Python service)
  const [renderMode, setRenderMode] = useState<RenderMode>("primitive");
  const [smplAvailable, setSmplAvailable] = useState<boolean | null>(null); // null = checking
  const [smplInfo, setSmplInfo] = useState<{ vertices: number; faces: number; type: string } | null>(null);
  const [meshLoading, setMeshLoading] = useState(false);

  // Body measurements (Tab 1)
  const [measurements, setMeasurements] = useState<BodyMeasurements>({
    height: 170,
    weight: 65,
    chest: 90,
    waist: 75,
    hip: 95,
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Direct β control (Tab 2: Advanced)
  const [directBetas, setDirectBetas] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [betaSource, setBetaSource] = useState<"measurements" | "direct">("measurements");

  // SMPL β from measurements
  const smplResult = useMemo(
    () => measurementsToSMPLBeta(measurements),
    [measurements]
  );
  const bodyScales: BodyPartScales = useMemo(
    () => betaToBodyScales(smplResult.beta),
    [smplResult.beta]
  );

  // Active β (depends on source)
  const activeBetas = betaSource === "measurements" ? smplResult.beta : directBetas;
  const activeScales = betaSource === "measurements"
    ? bodyScales
    : betaToBodyScales(directBetas);

  // Product selection for try-on
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [clothingOverlay, setClothingOverlay] = useState<ClothingParams | null>(null);
  const [clothingColor, setClothingColor] = useState<string | null>(null);
  const [tryResult, setTryResult] = useState<{
    size: string;
    fitScore: number;
    comment: string;
  } | null>(null);
  const [tryLoading, setTryLoading] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ---------- Check SMPL service availability ----------
  useEffect(() => {
    async function checkSmpl() {
      try {
        const res = await fetch(`${SMPL_SERVICE_URL}/info`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const info = await res.json();
          setSmplAvailable(true);
          setSmplInfo({
            vertices: info.n_vertices,
            faces: info.n_faces,
            type: info.model_type,
          });
          setRenderMode("smpl"); // Auto-switch nếu SMPL sẵn sàng
        } else {
          setSmplAvailable(false);
        }
      } catch {
        setSmplAvailable(false);
      }
    }
    checkSmpl();
  }, []);

  // ---------- Fetch products ----------
  useEffect(() => {
    api
      .get<{ products: Product[] }>("/products", { limit: 50 })
      .then((d) => setProducts(d.products || []))
      .catch(() => {});
  }, []);

  // ---------- Actions ----------

  // 1. Save body profile
  async function handleSaveProfile() {
    setProfileLoading(true);
    try {
      await api.post("/fitting-room/body-profile", {
        height: measurements.height,
        weight: measurements.weight,
        chest: measurements.chest,
        waist: measurements.waist,
        hip: measurements.hip,
      });
      setProfileSaved(true);
      setBetaSource("measurements");
      setTab("tryon");
    } catch {
      alert("Lỗi lưu thông số cơ thể");
    } finally {
      setProfileLoading(false);
    }
  }

  // 2. Try product
  async function handleTryProduct(product: Product) {
    setSelectedProduct(product);
    setTryLoading(true);
    setTryResult(null);

    // Local SMPL recommendation (instant)
    const localRec = recommendSize(smplResult);
    const clothParams = getClothingParams("tshirt");
    setClothingOverlay(clothParams);
    setClothingColor(clothParams.color);

    try {
      // Also call backend (for persistent history)
      const res = await api.post<{
        result: {
          recommended_size: string;
          fit_score: number;
          ai_comment: string;
        };
      }>("/fitting-room/try", {
        product_id: product._id,
        height: measurements.height,
        weight: measurements.weight,
        chest: measurements.chest,
        waist: measurements.waist,
        hip: measurements.hip,
      });

      setTryResult({
        size: res.result.recommended_size,
        fitScore: res.result.fit_score,
        comment: res.result.ai_comment,
      });
    } catch {
      // Fallback to local recommendation
      setTryResult({
        size: localRec.size,
        fitScore: localRec.fitScore,
        comment: localRec.comment,
      });
    } finally {
      setTryLoading(false);
    }
  }

  // 3. Fetch history
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.get<{ history: HistoryItem[] }>(
        "/fitting-room/history"
      );
      setHistory(data.history || []);
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  // Clear clothing
  function clearTryOn() {
    setSelectedProduct(null);
    setClothingOverlay(null);
    setClothingColor(null);
    setTryResult(null);
  }

  // ---------- Helpers ----------
  function updateMeasurement(key: keyof BodyMeasurements, value: number) {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
  }

  function updateBeta(index: number, value: number) {
    setDirectBetas((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function resetBetas() {
    setDirectBetas([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }

  function syncBetasFromMeasurements() {
    setDirectBetas([...smplResult.beta]);
    setBetaSource("direct");
  }

  if (!isLoggedIn) return null;

  // ==================== Render ====================
  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Phòng thử đồ ảo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mô hình SMPL — train trên ~4000 bản scan 3D người thật — 10 β parameters điều khiển hình dạng cơ thể
          </p>
        </div>
        {/* SMPL Service status */}
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${smplAvailable ? "bg-green-500" : smplAvailable === false ? "bg-red-400" : "bg-yellow-400 animate-pulse"}`}></span>
            <span className="text-xs text-gray-400">
              {smplAvailable ? "SMPL Service" : smplAvailable === false ? "SMPL Offline" : "Checking..."}
            </span>
          </div>
          {smplInfo && (
            <p className="text-[10px] text-gray-300 mt-0.5">
              {smplInfo.type === "smpl_pkl" ? "SMPL .pkl" : "Procedural"} · {smplInfo.vertices}v · {smplInfo.faces}f
            </p>
          )}
        </div>
      </div>

      {/* Render mode toggle */}
      <div className="flex items-center gap-3 mb-6 bg-gray-50 rounded-lg p-3">
        <span className="text-xs text-gray-500 font-medium">Render:</span>
        <button
          onClick={() => setRenderMode("primitive")}
          className={`px-3 py-1.5 text-xs rounded-md transition font-medium ${
            renderMode === "primitive"
              ? "bg-white shadow text-gray-800"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Primitive (Offline)
        </button>
        <button
          onClick={() => smplAvailable && setRenderMode("smpl")}
          disabled={!smplAvailable}
          className={`px-3 py-1.5 text-xs rounded-md transition font-medium ${
            renderMode === "smpl"
              ? "bg-white shadow text-gray-800"
              : smplAvailable
              ? "text-gray-400 hover:text-gray-600"
              : "text-gray-300 cursor-not-allowed"
          }`}
        >
          SMPL Mesh (Python)
        </button>
        {meshLoading && (
          <span className="text-xs text-primary animate-pulse ml-2">Đang sinh mesh...</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6 overflow-x-auto">
        {(
          [
            { key: "measure", label: "① Nhập số đo" },
            { key: "beta", label: "② β Parameters" },
            { key: "tryon", label: "③ Thử đồ" },
            { key: "history", label: "④ Lịch sử" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              tab === t.key
                ? "border-primary text-gray-800"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ==================== TAB 1: Nhập số đo ==================== */}
      {tab === "measure" && (
        <div className="grid lg:grid-cols-[1fr_1fr] gap-8">
          {/* Left: 3D Preview */}
          <div>
            <FittingScene
              renderMode={renderMode}
              scales={bodyScales}
              betas={smplResult.beta}
              autoRotate={autoRotate}
              smplServiceUrl={SMPL_SERVICE_URL}
              onLoading={setMeshLoading}
            />
            <div className="flex items-center gap-4 mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(e) => setAutoRotate(e.target.checked)}
                  className="accent-primary"
                />
                Tự xoay
              </label>
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-white rounded-xl shadow p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-800">
              Thông số cơ thể
            </h2>
            <p className="text-xs text-gray-400">
              Nhập số đo thực → tự động tính 10 β parameters → render body 3D realtime.
            </p>

            {/* β vector display */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-mono text-gray-500 mb-1">
                β = [{smplResult.beta.map((b) => b.toFixed(2)).join(", ")}]
              </p>
              <p className="text-xs text-gray-400">
                BMI: {smplResult.bmi} · Dáng: {smplResult.bodyType}
              </p>
            </div>

            {/* Sliders */}
            {([
              { key: "height", label: "Chiều cao", unit: "cm", min: 140, max: 200, step: 1 },
              { key: "weight", label: "Cân nặng", unit: "kg", min: 35, max: 130, step: 0.5 },
              { key: "chest", label: "Vòng ngực", unit: "cm", min: 60, max: 130, step: 1 },
              { key: "waist", label: "Vòng eo", unit: "cm", min: 50, max: 120, step: 1 },
              { key: "hip", label: "Vòng hông", unit: "cm", min: 60, max: 130, step: 1 },
            ] as const).map((f) => (
              <div key={f.key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 font-medium">{f.label}</span>
                  <span className="text-gray-500 font-mono">
                    {measurements[f.key]} {f.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={measurements[f.key]}
                  onChange={(e) =>
                    updateMeasurement(f.key, Number(e.target.value))
                  }
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-gray-300">
                  <span>{f.min}</span>
                  <span>{f.max}</span>
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={profileLoading}
                className="flex-1 py-3 bg-primary hover:bg-yellow-400 text-gray-800 font-semibold rounded-lg transition disabled:opacity-50"
              >
                {profileLoading
                  ? "Đang lưu..."
                  : profileSaved
                  ? "✓ Đã lưu – Cập nhật lại"
                  : "Lưu thông số & Thử đồ →"}
              </button>
              <button
                onClick={() => { syncBetasFromMeasurements(); setTab("beta"); }}
                className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-lg transition text-sm"
                title="Chuyển sang tab β để fine-tune"
              >
                β →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: Direct β Parameters ==================== */}
      {tab === "beta" && (
        <div className="grid lg:grid-cols-[1fr_1fr] gap-8">
          {/* Left: 3D Preview */}
          <div>
            <FittingScene
              renderMode={renderMode}
              scales={activeScales}
              betas={directBetas}
              autoRotate={autoRotate}
              smplServiceUrl={SMPL_SERVICE_URL}
              onLoading={setMeshLoading}
            />
            <div className="flex items-center gap-4 mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(e) => setAutoRotate(e.target.checked)}
                  className="accent-primary"
                />
                Tự xoay
              </label>
            </div>
          </div>

          {/* Right: β Sliders */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  SMPL β Parameters
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Điều chỉnh trực tiếp 10 tham số shape — mỗi β thay đổi một khía cạnh cơ thể
                </p>
              </div>
              <button
                onClick={resetBetas}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition text-gray-500"
              >
                Reset β = 0
              </button>
            </div>

            {/* SMPL Theory Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-700">
              <p className="font-semibold mb-1">SMPL Model Theory:</p>
              <p className="leading-relaxed">
                Model SMPL được train trên ~4000 bản scan 3D người thật. Sử dụng PCA
                decomposition, hình dạng cơ thể được biểu diễn bởi 10 components chính (β₀…β₉).
                <br />
                <strong>v = v_template + Σ(βᵢ × shapedirs_i)</strong>
                <br />
                Mỗi β ∈ [-3, 3], giá trị 0 = body trung bình, âm = nhỏ hơn, dương = lớn hơn.
              </p>
            </div>

            {/* β vector display (realtime) */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-mono text-gray-500">
                β = [{directBetas.map((b) => b.toFixed(2)).join(", ")}]
              </p>
            </div>

            {/* 10 β Sliders */}
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {BETA_LABELS.map((bDef) => (
                <div key={bDef.index} className="space-y-0.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 font-medium text-xs">{bDef.label}</span>
                    <span className="text-gray-400 font-mono text-xs">
                      {directBetas[bDef.index].toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={bDef.min}
                    max={bDef.max}
                    step={0.05}
                    value={directBetas[bDef.index]}
                    onChange={(e) => updateBeta(bDef.index, Number(e.target.value))}
                    className="w-full accent-primary h-1.5"
                  />
                  <div className="flex justify-between text-[9px] text-gray-300">
                    <span>{bDef.desc.split(" ↔ ")[0]}</span>
                    <span>{bDef.desc.split(" ↔ ")[1]}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick presets */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Preset nhanh:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Trung bình", betas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
                  { label: "Cao gầy", betas: [2, -1.5, -0.5, -1, -0.5, -1.5, 0.5, 0.5, 0.5, -1] },
                  { label: "Thấp mập", betas: [-1.5, 2, 1.5, 1.5, 1.5, 2, -0.5, -0.5, -0.5, 1] },
                  { label: "Vận động viên", betas: [1, 0.5, 1.5, -0.5, 0.5, -0.5, 2, 1, 0.5, 0.5] },
                  { label: "Nữ kiểu mẫu", betas: [1.5, -0.5, 0.5, -1, 1, -0.5, 1.5, 2, 0, -0.5] },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => { setDirectBetas(preset.betas); setBetaSource("direct"); }}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-primary hover:text-gray-800 rounded-full transition text-gray-600"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setBetaSource("direct"); setTab("tryon"); }}
              className="w-full py-3 bg-primary hover:bg-yellow-400 text-gray-800 font-semibold rounded-lg transition"
            >
              Áp dụng β & Thử đồ →
            </button>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: Thử đồ ==================== */}
      {tab === "tryon" && (
        <div className="grid lg:grid-cols-[1fr_1fr] gap-8">
          {/* Left: 3D Preview with clothing */}
          <div>
            <FittingScene
              renderMode={renderMode}
              scales={activeScales}
              betas={activeBetas}
              clothing={clothingOverlay}
              clothingColor={clothingColor}
              autoRotate={autoRotate}
              smplServiceUrl={SMPL_SERVICE_URL}
              onLoading={setMeshLoading}
            />
            <div className="flex items-center justify-between mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(e) => setAutoRotate(e.target.checked)}
                  className="accent-primary"
                />
                Tự xoay
              </label>
              {clothingOverlay && (
                <div className="flex gap-2">
                  {(
                    ["tshirt", "shirt", "pants", "jacket", "dress"] as const
                  ).map((type) => {
                    const params = getClothingParams(type);
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          setClothingOverlay(params);
                          setClothingColor(params.color);
                        }}
                        className={`px-2 py-1 text-xs rounded border transition ${
                          clothingOverlay.type === type
                            ? "bg-primary border-primary"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active β display */}
            <div className="mt-3 bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] font-mono text-gray-400">
                {betaSource === "measurements" ? "Từ số đo" : "β trực tiếp"}: [{activeBetas.map((b) => b.toFixed(1)).join(", ")}]
              </p>
            </div>

            {/* Try result */}
            {tryResult && (
              <div className="mt-4 bg-white rounded-xl shadow p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      tryResult.fitScore >= 85
                        ? "bg-green-500"
                        : tryResult.fitScore >= 70
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  >
                    {tryResult.fitScore}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      Size gợi ý:{" "}
                      <span className="text-primary text-xl">
                        {tryResult.size}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      Điểm phù hợp: {tryResult.fitScore}/100
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{tryResult.comment}</p>
                <button
                  onClick={clearTryOn}
                  className="text-sm text-gray-400 hover:text-gray-600 underline"
                >
                  Thử sản phẩm khác
                </button>
              </div>
            )}
          </div>

          {/* Right: Product list */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Chọn sản phẩm để thử
            </h2>

            {!profileSaved && betaSource === "measurements" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-700">
                 Hãy nhập thông số cơ thể ở tab ① hoặc điều chỉnh β ở tab ② trước khi thử đồ.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {products.map((p) => (
                <button
                  key={p._id}
                  onClick={() => handleTryProduct(p)}
                  disabled={tryLoading}
                  className={`text-left bg-white rounded-lg border p-3 hover:border-primary transition ${
                    selectedProduct?._id === p._id
                      ? "border-primary ring-2 ring-primary/30"
                      : ""
                  }`}
                >
                  {p.image_url && (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-28 object-cover rounded-md mb-2"
                    />
                  )}
                  <p className="text-sm font-medium text-gray-800 line-clamp-2">
                    {p.name}
                  </p>
                  <p className="text-xs text-red-500 font-semibold mt-1">
                    {formatVNDWithComma(p.price)}đ
                  </p>
                  {selectedProduct?._id === p._id && tryLoading && (
                    <p className="text-xs text-primary mt-1 animate-pulse">
                      Đang phân tích...
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: Lịch sử ==================== */}
      {tab === "history" && (
        <div>
          {historyLoading ? (
            <div className="text-center py-12 text-gray-400">Đang tải...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Bạn chưa thử sản phẩm nào.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((h) => (
                <div
                  key={h._id}
                  className="bg-white rounded-lg shadow p-4 flex items-start gap-4"
                >
                  {h.product_id?.image_url && (
                    <img
                      src={h.product_id.image_url}
                      alt=""
                      className="w-20 h-20 rounded-lg object-cover border"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {h.product_id?.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${
                          h.fit_score >= 85
                            ? "bg-green-500"
                            : h.fit_score >= 70
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                      >
                        {h.fit_score}%
                      </span>
                      <span className="text-gray-600">
                        Size: <strong>{h.recommended_size}</strong>
                      </span>
                      <span className="text-gray-400">
                        {h.user_height}cm / {h.user_weight}kg
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{h.ai_comment}</p>
                    <p className="text-xs text-gray-300 mt-1">
                      {new Date(h.created_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
