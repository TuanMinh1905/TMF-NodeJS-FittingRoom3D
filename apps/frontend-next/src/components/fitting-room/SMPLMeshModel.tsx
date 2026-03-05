// ===== SMPLMeshModel — Render SMPL mesh thật từ Python service =====
// Nhận vertices + faces từ API → tạo Three.js BufferGeometry → render mesh
// Khi β thay đổi → gọi API lại → cập nhật geometry realtime
//
// So với HumanModel.tsx (primitive-based):
// - HumanModel: dùng box/sphere/cylinder ghép lại → mannequin đơn giản
// - SMPLMeshModel: render mesh thật 3000+ vertices → body chính xác

"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ==================== Types ====================

interface SMPLMeshData {
  vertices: number[];   // flat: [x0,y0,z0, x1,y1,z1, ...]
  faces: number[];      // flat: [i0,j0,k0, i1,j1,k1, ...]
  n_vertices: number;
  n_faces: number;
}

interface SMPLMeshModelProps {
  /** 10 SMPL β shape parameters */
  betas: number[];
  /** SMPL Python service URL */
  serviceUrl?: string;
  /** Clothing overlay: semi-transparent shell */
  clothingColor?: string | null;
  /** Auto-rotate model */
  autoRotate?: boolean;
  /** Callback khi mesh loaded lần đầu */
  onMeshLoaded?: (info: { vertices: number; faces: number }) => void;
  /** Callback khi đang loading */
  onLoading?: (loading: boolean) => void;
}

// SMPL service endpoint
const DEFAULT_SERVICE_URL = "http://localhost:8001";

// ==================== Component ====================

export default function SMPLMeshModel({
  betas,
  serviceUrl = DEFAULT_SERVICE_URL,
  clothingColor = null,
  autoRotate = false,
  onMeshLoaded,
  onLoading,
}: SMPLMeshModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const clothingMeshRef = useRef<THREE.Mesh>(null);

  const [meshData, setMeshData] = useState<SMPLMeshData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounce β changes — chỉ gọi API sau 100ms không thay đổi
  const betasKey = betas.map((b) => b.toFixed(3)).join(",");
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchMesh = useCallback(
    async (betaValues: number[]) => {
      try {
        onLoading?.(true);
        const res = await fetch(`${serviceUrl}/mesh/compressed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ betas: betaValues }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: SMPLMeshData = await res.json();
        setMeshData(data);
        setError(null);
        onMeshLoaded?.({ vertices: data.n_vertices, faces: data.n_faces });
      } catch (err) {
        console.warn("[SMPLMesh] Fetch failed:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        onLoading?.(false);
      }
    },
    [serviceUrl, onMeshLoaded, onLoading]
  );

  // Fetch mesh khi β thay đổi (debounced)
  useEffect(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);

    fetchTimeoutRef.current = setTimeout(() => {
      fetchMesh(betas);
    }, 100);

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [betasKey, fetchMesh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build geometry from mesh data
  const geometry = useMemo(() => {
    if (!meshData) return null;

    const geo = new THREE.BufferGeometry();

    // Vertices: flat Float32Array
    const positions = new Float32Array(meshData.vertices);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // Faces → index buffer
    const indices = new Uint32Array(meshData.faces);
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    // Compute normals for lighting
    geo.computeVertexNormals();

    return geo;
  }, [meshData]);

  // Clothing geometry (slightly inflated)
  const clothingGeometry = useMemo(() => {
    if (!meshData || !clothingColor) return null;

    const geo = new THREE.BufferGeometry();

    // Inflate vertices slightly outward from center
    const positions = new Float32Array(meshData.vertices.length);
    for (let i = 0; i < meshData.n_vertices; i++) {
      const x = meshData.vertices[i * 3];
      const y = meshData.vertices[i * 3 + 1];
      const z = meshData.vertices[i * 3 + 2];

      // Direction from center axis (XZ plane)
      const dx = x;
      const dz = z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;

      // Inflate by 1.5cm outward + 0.5cm upward
      const inflate = 0.015;
      positions[i * 3] = x + (dx / dist) * inflate;
      positions[i * 3 + 1] = y + 0.003;
      positions[i * 3 + 2] = z + (dz / dist) * inflate;
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(
      new THREE.BufferAttribute(new Uint32Array(meshData.faces), 1)
    );
    geo.computeVertexNormals();

    return geo;
  }, [meshData, clothingColor]);

  // Materials
  const skinMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#EDCBA0",
        roughness: 0.65,
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
    []
  );

  const clothingMaterial = useMemo(() => {
    if (!clothingColor) return null;
    return new THREE.MeshStandardMaterial({
      color: clothingColor,
      roughness: 0.75,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });
  }, [clothingColor]);

  // Auto-rotate
  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  // Error state → fallback text
  if (error && !meshData) {
    return (
      <group ref={groupRef}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial color="#ff6b6b" wireframe />
        </mesh>
      </group>
    );
  }

  if (!geometry) return null;

  return (
    <group ref={groupRef}>
      {/* Body mesh */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />

      {/* Clothing overlay */}
      {clothingGeometry && clothingMaterial && (
        <mesh
          ref={clothingMeshRef}
          geometry={clothingGeometry}
          material={clothingMaterial}
          castShadow
        />
      )}
    </group>
  );
}
