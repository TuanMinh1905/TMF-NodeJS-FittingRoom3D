// ===== SMPL β-parameter mapping =====
// SMPL (Skinned Multi-Person Linear Model) dùng 10 tham số β (shape) để mô
// phỏng hình dạng cơ thể người. Ở đây ta tạo hàm chuyển đổi từ số đo thực
// (height, weight, chest, waist, hip) → β vector, rồi từ β → tỷ lệ các bộ
// phận cơ thể để render 3D bằng Three.js.
//
// Tham khảo paper gốc:
//   Loper et al., "SMPL: A Skinned Multi-Person Linear Model", 2015
//   β ∈ ℝ¹⁰, θ ∈ ℝ⁷² (pose)
//
// Trong project này ta chỉ dùng β (shape), không dùng θ (pose) vì mannequin
// đứng yên ở T-pose.

// ---------- Types ----------

export interface BodyMeasurements {
  height: number; // cm
  weight: number; // kg
  chest: number; // cm (vòng ngực)
  waist: number; // cm (vòng eo)
  hip: number; // cm (vòng hông)
}

export interface SMPLResult {
  /** 10 shape coefficients – β₀…β₉ */
  beta: number[];
  /** BMI tính từ height + weight */
  bmi: number;
  /** Body type label */
  bodyType: "slim" | "average" | "fit" | "large" | "plus";
}

/** Scale factors cho từng bộ phận – đầu ra cuối cùng để điều khiển mesh 3D */
export interface BodyPartScales {
  // head
  headRadius: number;
  // neck
  neckRadius: number;
  neckLength: number;
  // torso
  shoulderWidth: number;
  chestRadius: number;
  chestDepth: number;
  waistRadius: number;
  waistDepth: number;
  hipRadius: number;
  hipDepth: number;
  torsoLength: number;
  // arms
  upperArmRadius: number;
  upperArmLength: number;
  lowerArmRadius: number;
  lowerArmLength: number;
  // legs
  thighRadius: number;
  thighLength: number;
  calfRadius: number;
  calfLength: number;
  // overall
  heightScale: number;
}

// ---------- Reference values (avg Vietnamese adult) ----------

const REF: BodyMeasurements = {
  height: 165,
  weight: 60,
  chest: 88,
  waist: 72,
  hip: 92,
};

// ---------- Measurement → β ----------

/**
 * Chuyển số đo cơ thể → 10 SMPL β parameters.
 *
 * Mapping logic (simplified PCA-like):
 *   β₀  = ∆height — chiều cao so với trung bình
 *   β₁  = ∆weight — cân nặng
 *   β₂  = ∆chest  — vòng ngực
 *   β₃  = ∆waist  — vòng eo
 *   β₄  = ∆hip    — vòng hông
 *   β₅  = BMI deviation — chỉ số BMI
 *   β₆  = chest-waist ratio — tỷ lệ ngực/eo
 *   β₇  = hip-waist ratio  — tỷ lệ hông/eo
 *   β₈  = torso proportion  — tỷ lệ thân trên
 *   β₉  = weight/height     — tỷ lệ cân nặng/chiều cao
 */
export function measurementsToSMPLBeta(m: BodyMeasurements): SMPLResult {
  const bmi = m.weight / (m.height / 100) ** 2;

  const beta: number[] = [
    /* β₀ height     */ (m.height - REF.height) / 15,
    /* β₁ weight     */ (m.weight - REF.weight) / 20,
    /* β₂ chest      */ (m.chest - REF.chest) / 15,
    /* β₃ waist      */ (m.waist - REF.waist) / 12,
    /* β₄ hip        */ (m.hip - REF.hip) / 15,
    /* β₅ BMI        */ (bmi - 22) / 8,
    /* β₆ chest/wst  */ (m.chest - m.waist) / 20,
    /* β₇ hip/wst    */ (m.hip - m.waist) / 20,
    /* β₈ torso prop */ ((m.height / 100) * 0.53 - m.waist / 100) * 5,
    /* β₉ w/h ratio  */ (m.weight / m.height - 0.36) * 10,
  ];

  let bodyType: SMPLResult["bodyType"] = "average";
  if (bmi < 18.5) bodyType = "slim";
  else if (bmi < 22) bodyType = "fit";
  else if (bmi < 25) bodyType = "average";
  else if (bmi < 30) bodyType = "large";
  else bodyType = "plus";

  return {
    beta,
    bmi: Math.round(bmi * 10) / 10,
    bodyType,
  };
}

// ---------- β → Body-part scales ----------

/**
 * Chuyển β vector → scales cho từng bộ phận mannequin.
 * Mỗi giá trị scale mặc định = 1.0 (reference body).
 * β dương → phần đó lớn hơn trung bình; β âm → nhỏ hơn.
 */
export function betaToBodyScales(beta: number[]): BodyPartScales {
  const b = (i: number) => beta[i] ?? 0;

  return {
    // Head – ít thay đổi
    headRadius: 1.0 + b(1) * 0.02,

    // Neck
    neckRadius: 1.0 + b(1) * 0.04 + b(5) * 0.02,
    neckLength: 1.0 + b(0) * 0.02,

    // Torso – bị ảnh hưởng nhiều bởi β₁(weight), β₂(chest), β₃(waist), β₄(hip)
    shoulderWidth: 1.0 + b(2) * 0.08 + b(1) * 0.05 + b(0) * 0.02,
    chestRadius: 1.0 + b(2) * 0.10 + b(1) * 0.06,
    chestDepth: 1.0 + b(2) * 0.08 + b(5) * 0.04,
    waistRadius: 1.0 + b(3) * 0.10 + b(1) * 0.08 + b(5) * 0.05,
    waistDepth: 1.0 + b(3) * 0.08 + b(5) * 0.04,
    hipRadius: 1.0 + b(4) * 0.10 + b(1) * 0.05,
    hipDepth: 1.0 + b(4) * 0.08 + b(5) * 0.03,
    torsoLength: 1.0 + b(0) * 0.04 + b(8) * 0.02,

    // Arms
    upperArmRadius: 1.0 + b(1) * 0.08 + b(5) * 0.04,
    upperArmLength: 1.0 + b(0) * 0.05,
    lowerArmRadius: 1.0 + b(1) * 0.05 + b(5) * 0.03,
    lowerArmLength: 1.0 + b(0) * 0.05,

    // Legs
    thighRadius: 1.0 + b(4) * 0.06 + b(1) * 0.08 + b(5) * 0.04,
    thighLength: 1.0 + b(0) * 0.06,
    calfRadius: 1.0 + b(1) * 0.05 + b(5) * 0.03,
    calfLength: 1.0 + b(0) * 0.06,

    // Overall
    heightScale: 1.0 + b(0) * 0.05,
  };
}

// ---------- Size recommendation ----------

export type ClothingSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "3XL";

/** Gợi ý size dựa trên β parameters + BMI */
export function recommendSize(result: SMPLResult): {
  size: ClothingSize;
  fitScore: number;
  comment: string;
} {
  const { beta, bmi, bodyType } = result;

  // Tính composite score từ β₁(weight), β₂(chest), β₃(waist)
  const composite = beta[1] * 0.4 + beta[2] * 0.3 + beta[3] * 0.3;

  let size: ClothingSize;
  let fitScore: number;

  if (composite < -1.2) {
    size = "XS";
    fitScore = 80;
  } else if (composite < -0.6) {
    size = "S";
    fitScore = 85;
  } else if (composite < 0.3) {
    size = "M";
    fitScore = 90;
  } else if (composite < 0.8) {
    size = "L";
    fitScore = 85;
  } else if (composite < 1.3) {
    size = "XL";
    fitScore = 80;
  } else if (composite < 1.8) {
    size = "XXL";
    fitScore = 75;
  } else {
    size = "3XL";
    fitScore = 70;
  }

  // Adjust fit score based on how close to centre of size range
  const distFromCentre = Math.abs(composite - getSizeCentre(size));
  fitScore = Math.max(50, Math.round(fitScore - distFromCentre * 5));

  // Height adjustment
  const heightBeta = beta[0];
  if (heightBeta > 0.5 && (size === "S" || size === "XS")) {
    size = nextSize(size);
    fitScore = Math.max(50, fitScore - 5);
  } else if (heightBeta < -0.5 && (size === "XL" || size === "XXL")) {
    size = prevSize(size);
    fitScore = Math.max(50, fitScore - 5);
  }

  const comment = buildComment(bmi, bodyType, size, fitScore);

  return { size, fitScore, comment };
}

function getSizeCentre(s: ClothingSize): number {
  const map: Record<ClothingSize, number> = {
    XS: -1.5,
    S: -0.9,
    M: -0.15,
    L: 0.55,
    XL: 1.05,
    XXL: 1.55,
    "3XL": 2.0,
  };
  return map[s];
}

function nextSize(s: ClothingSize): ClothingSize {
  const order: ClothingSize[] = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
  const i = order.indexOf(s);
  return order[Math.min(i + 1, order.length - 1)];
}

function prevSize(s: ClothingSize): ClothingSize {
  const order: ClothingSize[] = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
  const i = order.indexOf(s);
  return order[Math.max(i - 1, 0)];
}

function buildComment(
  bmi: number,
  bodyType: string,
  size: ClothingSize,
  fitScore: number
): string {
  const bodyLabels: Record<string, string> = {
    slim: "mảnh",
    fit: "cân đối",
    average: "trung bình",
    large: "đầy đặn",
    plus: "ngoại cỡ",
  };
  const label = bodyLabels[bodyType] || "trung bình";

  let msg = `BMI ${bmi} – dáng người ${label}. Gợi ý size ${size} (độ phù hợp ${fitScore}%).`;

  if (fitScore >= 85) {
    msg += " Sản phẩm sẽ vừa vặn tuyệt vời!";
  } else if (fitScore >= 75) {
    msg += " Sản phẩm khá phù hợp với bạn.";
  } else {
    msg += " Bạn có thể thử thêm size lân cận để tìm size thoải mái nhất.";
  }

  return msg;
}

// ---------- Clothing geometry parameters ----------

/** Thông số hình học quần áo – dùng để render overlay lên mannequin */
export interface ClothingParams {
  type: "tshirt" | "shirt" | "pants" | "jacket" | "dress";
  /** Mầu sản phẩm */
  color: string;
  /** Offset so với body (để quần áo bọc ngoài body) */
  offset: number;
  /** Phần cơ thể mà quần áo phủ lên */
  coversParts: (
    | "chest"
    | "waist"
    | "hip"
    | "upperArm"
    | "lowerArm"
    | "thigh"
    | "calf"
  )[];
}

export function getClothingParams(type: ClothingParams["type"]): ClothingParams {
  switch (type) {
    case "tshirt":
      return {
        type,
        color: "#4A90D9",
        offset: 0.02,
        coversParts: ["chest", "waist", "upperArm"],
      };
    case "shirt":
      return {
        type,
        color: "#F5F5F5",
        offset: 0.025,
        coversParts: ["chest", "waist", "upperArm", "lowerArm"],
      };
    case "pants":
      return {
        type,
        color: "#2C3E50",
        offset: 0.02,
        coversParts: ["hip", "thigh", "calf"],
      };
    case "jacket":
      return {
        type,
        color: "#1A1A1A",
        offset: 0.035,
        coversParts: ["chest", "waist", "hip", "upperArm", "lowerArm"],
      };
    case "dress":
      return {
        type,
        color: "#E74C3C",
        offset: 0.025,
        coversParts: ["chest", "waist", "hip", "thigh"],
      };
  }
}
