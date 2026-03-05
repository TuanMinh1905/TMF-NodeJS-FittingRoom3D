// ===== 3D Parametric Human Model (SMPL-driven) =====
// Mannequin được xây từ primitive geometry (capsule, sphere, cylinder)
// Mỗi bộ phận được scale theo BodyPartScales từ SMPL β mapping.
// Render bằng @react-three/fiber (React Three Fiber).

"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BodyPartScales, ClothingParams } from "@/lib/smpl";

// ---------- Constants (base dimensions for reference body in metres) ----------
const BASE = {
  headR: 0.1,
  neckR: 0.04,
  neckH: 0.06,
  chestW: 0.18,
  chestH: 0.2,
  chestD: 0.12,
  waistW: 0.15,
  waistH: 0.12,
  waistD: 0.1,
  hipW: 0.17,
  hipH: 0.12,
  hipD: 0.11,
  upperArmR: 0.035,
  upperArmH: 0.25,
  lowerArmR: 0.03,
  lowerArmH: 0.24,
  thighR: 0.06,
  thighH: 0.38,
  calfR: 0.04,
  calfH: 0.38,
};

// ---------- Skin material ----------
const SKIN_COLOR = "#EDCBA0";
const SKIN_MATERIAL = new THREE.MeshStandardMaterial({
  color: SKIN_COLOR,
  roughness: 0.7,
  metalness: 0.0,
});

// ---------- Sub-component: Body Part ----------
interface PartProps {
  position: [number, number, number];
  scale?: [number, number, number];
  geometry: THREE.BufferGeometry;
  material?: THREE.Material;
  rotation?: [number, number, number];
}

function BodyPart({ position, scale, geometry, material, rotation }: PartProps) {
  return (
    <mesh
      position={position}
      scale={scale || [1, 1, 1]}
      geometry={geometry}
      material={material || SKIN_MATERIAL}
      rotation={rotation}
      castShadow
      receiveShadow
    />
  );
}

// ---------- Main Component ----------

interface HumanModelProps {
  scales: BodyPartScales;
  /** Optional clothing to overlay */
  clothing?: ClothingParams | null;
  /** Slow auto-rotate */
  autoRotate?: boolean;
}

export default function HumanModel({
  scales,
  clothing,
  autoRotate = false,
}: HumanModelProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Auto-rotate
  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  // Memoize geometries to avoid re-creation on every render
  const geo = useMemo(() => {
    return {
      head: new THREE.SphereGeometry(BASE.headR, 24, 24),
      neck: new THREE.CylinderGeometry(BASE.neckR, BASE.neckR, BASE.neckH, 12),
      chest: new THREE.BoxGeometry(BASE.chestW * 2, BASE.chestH, BASE.chestD * 2, 4, 4, 4),
      waist: new THREE.BoxGeometry(BASE.waistW * 2, BASE.waistH, BASE.waistD * 2, 4, 4, 4),
      hip: new THREE.BoxGeometry(BASE.hipW * 2, BASE.hipH, BASE.hipD * 2, 4, 4, 4),
      upperArm: new THREE.CapsuleGeometry(BASE.upperArmR, BASE.upperArmH, 8, 12),
      lowerArm: new THREE.CapsuleGeometry(BASE.lowerArmR, BASE.lowerArmH, 8, 12),
      thigh: new THREE.CapsuleGeometry(BASE.thighR, BASE.thighH, 8, 12),
      calf: new THREE.CapsuleGeometry(BASE.calfR, BASE.calfH, 8, 12),
      hand: new THREE.SphereGeometry(0.035, 12, 12),
      foot: new THREE.BoxGeometry(0.08, 0.04, 0.14),
    };
  }, []);

  // Y positions (bottom to top, origin at feet)
  const s = scales;
  const footY = 0.02;
  const calfY = footY + 0.02 + BASE.calfH * s.calfLength * 0.5;
  const thighY = calfY + BASE.calfH * s.calfLength * 0.5 + BASE.thighH * s.thighLength * 0.5;
  const hipY = thighY + BASE.thighH * s.thighLength * 0.5 + BASE.hipH * 0.5;
  const waistY = hipY + BASE.hipH * 0.5 + BASE.waistH * 0.5;
  const chestY = waistY + BASE.waistH * 0.5 + BASE.chestH * 0.5;
  const neckY = chestY + BASE.chestH * 0.5 + BASE.neckH * s.neckLength * 0.5;
  const headY = neckY + BASE.neckH * s.neckLength * 0.5 + BASE.headR * s.headRadius;

  // Arm positions
  const shoulderX = BASE.chestW * s.shoulderWidth + BASE.upperArmR * s.upperArmRadius;
  const upperArmY = chestY + BASE.chestH * 0.3;
  const lowerArmY = upperArmY - BASE.upperArmH * s.upperArmLength - BASE.lowerArmH * s.lowerArmLength * 0.35;
  const handY = lowerArmY - BASE.lowerArmH * s.lowerArmLength * 0.5 - 0.04;

  // Leg X offset
  const legX = BASE.hipW * s.hipRadius * 0.5;

  // Clothing material
  const clothingMat = useMemo(() => {
    if (!clothing) return null;
    return new THREE.MeshStandardMaterial({
      color: clothing.color,
      roughness: 0.8,
      metalness: 0.0,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
  }, [clothing]);

  type CoverKey = ClothingParams["coversParts"][number];

  const coverSet = useMemo(
    () => new Set<CoverKey>(clothing?.coversParts || []),
    [clothing]
  );
  const off = clothing?.offset ?? 0;

  // Helper: pick material for a given body part
  function mat(partKey: CoverKey): THREE.Material {
    if (clothingMat && coverSet.has(partKey)) return clothingMat;
    return SKIN_MATERIAL;
  }
  // Helper: scale boost when covered by clothing
  function sc(
    partKey: CoverKey,
    sx: number,
    sy: number,
    sz: number
  ): [number, number, number] {
    if (clothingMat && coverSet.has(partKey)) {
      const o = 1 + off * 4;
      return [sx * o, sy, sz * o];
    }
    return [sx, sy, sz];
  }

  return (
    <group ref={groupRef} scale={[s.heightScale, s.heightScale, s.heightScale]}>
      {/* Head */}
      <BodyPart
        geometry={geo.head}
        position={[0, headY, 0]}
        scale={[s.headRadius, s.headRadius, s.headRadius]}
      />

      {/* Neck */}
      <BodyPart
        geometry={geo.neck}
        position={[0, neckY, 0]}
        scale={[s.neckRadius, s.neckLength, s.neckRadius]}
      />

      {/* Chest */}
      <BodyPart
        geometry={geo.chest}
        position={[0, chestY, 0]}
        scale={sc("chest", s.shoulderWidth, 1, s.chestDepth)}
        material={mat("chest")}
      />

      {/* Waist */}
      <BodyPart
        geometry={geo.waist}
        position={[0, waistY, 0]}
        scale={sc("waist", s.waistRadius, 1, s.waistDepth)}
        material={mat("waist")}
      />

      {/* Hip */}
      <BodyPart
        geometry={geo.hip}
        position={[0, hipY, 0]}
        scale={sc("hip", s.hipRadius, 1, s.hipDepth)}
        material={mat("hip")}
      />

      {/* ---- Left Arm ---- */}
      <BodyPart
        geometry={geo.upperArm}
        position={[shoulderX, upperArmY, 0]}
        scale={sc("upperArm", s.upperArmRadius, s.upperArmLength, s.upperArmRadius)}
        material={mat("upperArm")}
      />
      <BodyPart
        geometry={geo.lowerArm}
        position={[shoulderX, lowerArmY, 0]}
        scale={sc("lowerArm", s.lowerArmRadius, s.lowerArmLength, s.lowerArmRadius)}
        material={mat("lowerArm")}
      />
      <BodyPart geometry={geo.hand} position={[shoulderX, handY, 0]} />

      {/* ---- Right Arm ---- */}
      <BodyPart
        geometry={geo.upperArm}
        position={[-shoulderX, upperArmY, 0]}
        scale={sc("upperArm", s.upperArmRadius, s.upperArmLength, s.upperArmRadius)}
        material={mat("upperArm")}
      />
      <BodyPart
        geometry={geo.lowerArm}
        position={[-shoulderX, lowerArmY, 0]}
        scale={sc("lowerArm", s.lowerArmRadius, s.lowerArmLength, s.lowerArmRadius)}
        material={mat("lowerArm")}
      />
      <BodyPart geometry={geo.hand} position={[-shoulderX, handY, 0]} />

      {/* ---- Left Leg ---- */}
      <BodyPart
        geometry={geo.thigh}
        position={[legX, thighY - BASE.thighH * 0.15, 0]}
        scale={sc("thigh", s.thighRadius, s.thighLength, s.thighRadius)}
        material={mat("thigh")}
      />
      <BodyPart
        geometry={geo.calf}
        position={[legX, calfY, 0]}
        scale={sc("calf", s.calfRadius, s.calfLength, s.calfRadius)}
        material={mat("calf")}
      />
      <BodyPart
        geometry={geo.foot}
        position={[legX, footY, 0.03]}
      />

      {/* ---- Right Leg ---- */}
      <BodyPart
        geometry={geo.thigh}
        position={[-legX, thighY - BASE.thighH * 0.15, 0]}
        scale={sc("thigh", s.thighRadius, s.thighLength, s.thighRadius)}
        material={mat("thigh")}
      />
      <BodyPart
        geometry={geo.calf}
        position={[-legX, calfY, 0]}
        scale={sc("calf", s.calfRadius, s.calfLength, s.calfRadius)}
        material={mat("calf")}
      />
      <BodyPart
        geometry={geo.foot}
        position={[-legX, footY, 0.03]}
      />
    </group>
  );
}
