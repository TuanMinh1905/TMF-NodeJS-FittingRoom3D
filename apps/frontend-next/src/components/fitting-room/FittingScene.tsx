// ===== FittingScene – Canvas 3D hoàn chỉnh =====
// Hỗ trợ 2 render mode:
//   1. "primitive" — HumanModel (box/sphere ghép) — hoạt động offline
//   2. "smpl" — SMPLMeshModel (mesh thật từ Python service) — cần SMPL service
// Component này được dynamic-import (ssr: false) trong page.

"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Grid } from "@react-three/drei";
import HumanModel from "./HumanModel";
import SMPLMeshModel from "./SMPLMeshModel";
import type { BodyPartScales, ClothingParams } from "@/lib/smpl";

export type RenderMode = "primitive" | "smpl";

interface FittingSceneProps {
  /** Render mode: primitive (offline) hoặc smpl (Python service) */
  renderMode?: RenderMode;
  /** Body part scales — dùng cho primitive mode */
  scales: BodyPartScales;
  /** 10 β parameters — dùng cho SMPL mode */
  betas?: number[];
  /** Clothing overlay (primitive mode) */
  clothing?: ClothingParams | null;
  /** Clothing color (SMPL mode) */
  clothingColor?: string | null;
  /** Auto-rotate */
  autoRotate?: boolean;
  /** SMPL service URL */
  smplServiceUrl?: string;
  /** Callback khi SMPL mesh loaded */
  onMeshLoaded?: (info: { vertices: number; faces: number }) => void;
  /** Callback loading state */
  onLoading?: (loading: boolean) => void;
}

function SceneContent({
  renderMode = "primitive",
  scales,
  betas,
  clothing,
  clothingColor,
  autoRotate,
  smplServiceUrl,
  onMeshLoaded,
  onLoading,
}: FittingSceneProps) {
  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 5, -3]} intensity={0.3} />

      {/* Environment for nice reflections */}
      <Environment preset="studio" />

      {/* Model — chọn theo renderMode */}
      <group position={[0, renderMode === "smpl" ? -0.4 : -0.85, 0]}>
        {renderMode === "smpl" && betas ? (
          <SMPLMeshModel
            betas={betas}
            serviceUrl={smplServiceUrl}
            clothingColor={clothingColor}
            autoRotate={autoRotate}
            onMeshLoaded={onMeshLoaded}
            onLoading={onLoading}
          />
        ) : (
          <HumanModel scales={scales} clothing={clothing} autoRotate={autoRotate} />
        )}
      </group>

      {/* Floor shadows */}
      <ContactShadows
        position={[0, renderMode === "smpl" ? -0.4 : -0.85, 0]}
        opacity={0.4}
        scale={3}
        blur={2}
        far={2}
      />

      {/* Grid */}
      <Grid
        position={[0, renderMode === "smpl" ? -0.4 : -0.85, 0]}
        args={[4, 4]}
        cellSize={0.2}
        cellThickness={0.5}
        cellColor="#d4d4d4"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#a3a3a3"
        fadeDistance={6}
        fadeStrength={1}
        infiniteGrid
      />

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={0.8}
        maxDistance={4}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.85}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function FittingScene(props: FittingSceneProps) {
  return (
    <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden bg-gradient-to-b from-gray-50 to-gray-200">
      <Canvas
        shadows
        camera={{ position: [0, 0.3, 1.8], fov: 45 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <SceneContent {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
