// ===== Tính phí ship theo vùng (Backend) =====
// Dùng để validate + tính phí khi đặt hàng
// Dữ liệu zone mapping đồng bộ với frontend (vietnam-locations.ts)

export type ShippingZone = 'noi_thanh' | 'ngoai_thanh' | 'lan_can' | 'trong_nuoc' | 'vung_xa'

// ===== Bảng phí ship (đồng) — express = 0 là KHÔNG hỗ trợ =====
export const SHIPPING_RATES: Record<ShippingZone, { standard: number; fast: number; express: number }> = {
  noi_thanh:   { standard: 15000, fast: 30000, express: 50000 },
  ngoai_thanh: { standard: 20000, fast: 40000, express: 70000 },
  lan_can:     { standard: 25000, fast: 50000, express: 0 },
  trong_nuoc:  { standard: 35000, fast: 60000, express: 0 },
  vung_xa:     { standard: 50000, fast: 80000, express: 0 },
}

// Miễn phí ship tiêu chuẩn khi đơn >= ngưỡng (0 = không miễn phí vùng đó)
export const FREE_SHIPPING_THRESHOLDS: Record<ShippingZone, number> = {
  noi_thanh: 300000,
  ngoai_thanh: 500000,
  lan_can: 500000,
  trong_nuoc: 1000000,
  vung_xa: 0,
}

// ===== Province code → Zone mặc định =====
const PROVINCE_ZONES: Record<string, ShippingZone> = {
  // Nội thành (HCM & HN mặc định, quận nội thành)
  HCM: 'noi_thanh',
  HN: 'noi_thanh',
  // Lân cận HCM
  BD: 'lan_can', DNI: 'lan_can', LA: 'lan_can', BRVT: 'lan_can', TN: 'lan_can',
  // Lân cận HN
  BN: 'lan_can', HY: 'lan_can', HD: 'lan_can', VP: 'lan_can', HNA: 'lan_can',
  // TP trực thuộc TW
  DN: 'trong_nuoc', HP: 'trong_nuoc', CT: 'trong_nuoc',
  // Đông Nam Bộ
  BP: 'trong_nuoc',
  // ĐBSCL
  AG: 'trong_nuoc', BL: 'trong_nuoc', BTE: 'trong_nuoc', CM: 'trong_nuoc',
  DT: 'trong_nuoc', HGI: 'trong_nuoc', KG: 'trong_nuoc', ST: 'trong_nuoc',
  TG: 'trong_nuoc', TV: 'trong_nuoc', VL: 'trong_nuoc',
  // Bắc Trung Bộ
  THA: 'trong_nuoc', NA: 'trong_nuoc', HT: 'trong_nuoc',
  QB: 'trong_nuoc', QT: 'trong_nuoc', TTH: 'trong_nuoc',
  // Nam Trung Bộ
  QNA: 'trong_nuoc', QNG: 'trong_nuoc', BDI: 'trong_nuoc',
  PY: 'trong_nuoc', KH: 'trong_nuoc', NT: 'trong_nuoc', BTH: 'trong_nuoc',
  // Tây Nguyên
  DL: 'trong_nuoc', DNO: 'trong_nuoc', GL: 'trong_nuoc', LD: 'trong_nuoc', KT: 'trong_nuoc',
  // Miền Bắc
  TNG: 'trong_nuoc', PT: 'trong_nuoc', BG: 'trong_nuoc', ND: 'trong_nuoc',
  NB: 'trong_nuoc', TB: 'trong_nuoc', QNI: 'trong_nuoc', LS: 'trong_nuoc', HB: 'trong_nuoc',
  // Vùng xa
  HGG: 'vung_xa', CB: 'vung_xa', BK: 'vung_xa', TQ: 'vung_xa', YB: 'vung_xa',
  LC: 'vung_xa', DB: 'vung_xa', LCH: 'vung_xa', SL: 'vung_xa',
}

// ===== Quận/huyện ngoại thành HCM: override zone → ngoai_thanh =====
const HCM_OUTER_DISTRICTS = [
  'Huyện Bình Chánh', 'Huyện Cần Giờ', 'Huyện Củ Chi', 'Huyện Hóc Môn', 'Huyện Nhà Bè',
]

// ===== Quận/huyện ngoại thành HN: override zone → ngoai_thanh =====
const HN_OUTER_DISTRICTS = [
  'Thị xã Sơn Tây',
  'Huyện Ba Vì', 'Huyện Chương Mỹ', 'Huyện Đan Phượng', 'Huyện Đông Anh',
  'Huyện Gia Lâm', 'Huyện Hoài Đức', 'Huyện Mê Linh', 'Huyện Mỹ Đức',
  'Huyện Phú Xuyên', 'Huyện Phúc Thọ', 'Huyện Quốc Oai', 'Huyện Sóc Sơn',
  'Huyện Thạch Thất', 'Huyện Thanh Oai', 'Huyện Thanh Trì', 'Huyện Thường Tín', 'Huyện Ứng Hòa',
]

// ===== Lấy zone từ tỉnh + quận/huyện =====
export function getShippingZone(provinceCode: string, districtName?: string): ShippingZone {
  const baseZone = PROVINCE_ZONES[provinceCode] || 'trong_nuoc'

  // Check HCM/HN outer district overrides
  if (districtName) {
    if (provinceCode === 'HCM' && HCM_OUTER_DISTRICTS.includes(districtName)) {
      return 'ngoai_thanh'
    }
    if (provinceCode === 'HN' && HN_OUTER_DISTRICTS.includes(districtName)) {
      return 'ngoai_thanh'
    }
  }

  return baseZone
}

// ===== Tính phí ship =====
// Trả về: phí ship (>= 0), hoặc -1 nếu phương thức không hỗ trợ vùng này
export function calculateShippingFee(
  zone: ShippingZone,
  method: 'standard' | 'fast' | 'express',
  orderAmount: number,
): number {
  const rates = SHIPPING_RATES[zone]
  const fee = rates[method]

  // Phương thức không hỗ trợ
  if (fee === 0) return -1

  // Miễn phí standard shipping nếu đạt ngưỡng
  if (method === 'standard') {
    const threshold = FREE_SHIPPING_THRESHOLDS[zone]
    if (threshold > 0 && orderAmount >= threshold) return 0
  }

  return fee
}
