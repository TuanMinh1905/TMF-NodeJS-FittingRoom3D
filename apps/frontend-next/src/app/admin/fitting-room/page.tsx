// ===== TMFashion Admin – Quản lý phòng thử đồ =====
//
// SD: Admin quản lý phòng thử đồ
//   Xem danh sách sản phẩm + hình ảnh 3D → Trả kết quả
//   alt [Cập nhật hình ảnh 3D]: Cập nhật → Lưu → Trả kết quả
//   [không cập nhật]: Thoát → Danh sách hình ảnh 3D
//
// STM Quản lý phòng thử đồ (Admin):
//   [Xem danh sách] → Chọn sản phẩm → [Chỉnh sửa 3D] → Lưu → [Xem danh sách]

"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface FittingProduct {
  productId: string;
  productName: string;
  productImage?: string;
  model3dUrl: string | null;
  has3dModel: boolean;
  price: number;
  stock: number;
  totalTries: number;
  avgFitScore: number;
  mostPopularSize: string;
  sizeDistribution: Record<string, number>;
}

export default function AdminFittingRoomPage() {
  const [products, setProducts] = useState<FittingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "has3d" | "no3d">("all");

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ products: FittingProduct[] }>(
        "/fitting-room/admin/products"
      );
      setProducts(data.products || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function startEdit(p: FittingProduct) {
    setEditingId(p.productId);
    setEditUrl(p.model3dUrl || "");
  }

  async function handleSave(productId: string) {
    setSaving(true);
    try {
      await api.put(`/fitting-room/admin/products/${productId}`, {
        model_3d_url: editUrl,
      });
      setEditingId(null);
      fetchProducts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Lỗi cập nhật");
    } finally {
      setSaving(false);
    }
  }

  const filtered = products.filter((p) => {
    if (filter === "has3d") return p.has3dModel;
    if (filter === "no3d") return !p.has3dModel;
    return true;
  });

  const totalTries = products.reduce((s, p) => s + p.totalTries, 0);
  const withModel = products.filter((p) => p.has3dModel).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        Quản lý phòng thử đồ
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Tổng sản phẩm</p>
          <p className="text-2xl font-bold text-gray-800">{products.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Có mô hình 3D</p>
          <p className="text-2xl font-bold text-green-600">
            {withModel}
            <span className="text-sm text-gray-400 ml-1">
              / {products.length}
            </span>
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Tổng lượt thử đồ</p>
          <p className="text-2xl font-bold text-blue-600">{totalTries}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(
          [
            { key: "all", label: "Tất cả" },
            { key: "has3d", label: "Đã có 3D" },
            { key: "no3d", label: "Chưa có 3D" },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f.key
                ? "bg-primary text-gray-800"
                : "bg-white border hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-sm text-gray-500">
                <th className="text-left py-3 px-4">Sản phẩm</th>
                <th className="text-center py-3 px-4">3D Model</th>
                <th className="text-center py-3 px-4">Lượt thử</th>
                <th className="text-center py-3 px-4">Fit Score TB</th>
                <th className="text-center py-3 px-4">Size phổ biến</th>
                <th className="text-center py-3 px-4">Phân bố size</th>
                <th className="text-center py-3 px-4">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    Không có sản phẩm
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.productId} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.productImage || "/placeholder.png"}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover border"
                        />
                        <span className="font-medium text-gray-800 text-sm line-clamp-2">
                          {p.productName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.has3dModel ? (
                        <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                          ✓ Có
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-400 text-xs rounded-full">
                          Chưa có
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-medium">
                      {p.totalTries}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.avgFitScore > 0 ? (
                        <span
                          className={`text-sm font-bold ${
                            p.avgFitScore >= 80
                              ? "text-green-600"
                              : p.avgFitScore >= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {p.avgFitScore}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm font-medium">
                        {p.mostPopularSize}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {Object.keys(p.sizeDistribution).length > 0 ? (
                        <div className="flex gap-1 justify-center flex-wrap">
                          {Object.entries(p.sizeDistribution).map(
                            ([size, count]) => (
                              <span
                                key={size}
                                className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded"
                              >
                                {size}:{count}
                              </span>
                            )
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {editingId === p.productId ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            placeholder="URL mô hình 3D"
                            className="w-40 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <button
                            onClick={() => handleSave(p.productId)}
                            disabled={saving}
                            className="px-2 py-1 text-xs bg-primary rounded hover:bg-yellow-400 transition disabled:opacity-50"
                          >
                            Lưu
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 text-xs border rounded hover:bg-gray-100 transition"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(p)}
                          className="px-3 py-1 text-sm border rounded hover:bg-gray-100 transition"
                        >
                          {p.has3dModel ? "Sửa 3D" : "Thêm 3D"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
