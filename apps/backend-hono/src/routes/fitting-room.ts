// ==================== FITTING ROOM ROUTES (Phòng thay đồ / Thử đồ) ====================
//
// === SD: Quản lý phòng thử đồ (User) ===
// Flow:
//   alt [Sử dụng phòng thử đồ]:
//     1. Nhập thông số cơ thể → Gửi thông số → Trả kết quả → Hình ảnh model
//     2. Chọn đồ → Gửi thông số → Trả kết quả → Nhận xét từ AI
//   [không sử dụng]: Thoát → Về trang chủ
//
// === SD: Admin quản lý phòng thử đồ ===
// Flow:
//   Xem danh sách hình ảnh 3D → Trả kết quả
//   alt [Cập nhật hình ảnh 3D]:
//     Cập nhật hình ảnh 3D → Lưu → Trả kết quả
//   [không cập nhật]: Thoát → Danh sách hình ảnh 3D
//
// ---- User endpoints ----
// POST /fitting-room/body-profile     → Nhập thông số cơ thể → Trả hình ảnh model
// POST /fitting-room/try              → Chọn đồ → Nhận xét từ AI
// GET  /fitting-room/history          → Xem lịch sử thử đồ
//
// ---- Admin endpoints ----
// GET  /fitting-room/admin/products   → Xem danh sách hình ảnh 3D
// PUT  /fitting-room/admin/products/:id → Cập nhật hình ảnh 3D

import { Hono } from 'hono'
import { Product } from '../models/product.js'
import { User } from '../models/user.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types/env.js'
import mongoose, { Schema, Document, Types } from 'mongoose'

// ==================== Model: FittingSession ====================
// Lưu lịch sử mỗi lần user "thử đồ" → AI đánh giá
export interface IFittingSession extends Document {
  user_id: Types.ObjectId
  product_id: Types.ObjectId
  // Thông tin người dùng (body measurements)
  user_height: number    // Chiều cao (cm)
  user_weight: number    // Cân nặng (kg)
  user_chest: number     // Vòng ngực (cm)
  user_waist: number     // Vòng eo (cm)
  user_hip: number       // Vòng hông (cm)
  // Kết quả AI đánh giá
  recommended_size: string   // Size gợi ý: S, M, L, XL, XXL
  fit_score: number          // Điểm phù hợp (0–100)
  ai_comment: string         // Nhận xét từ AI
  created_at: Date
}

const FittingSessionSchema = new Schema<IFittingSession>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    user_height: { type: Number, required: true },
    user_weight: { type: Number, required: true },
    user_chest: { type: Number },
    user_waist: { type: Number },
    user_hip: { type: Number },
    recommended_size: { type: String, required: true },
    fit_score: { type: Number, required: true, min: 0, max: 100 },
    ai_comment: { type: String, required: true },
  },
  {
    timestamps: { createdAt: 'created_at' },
  }
)

const FittingSession = mongoose.model<IFittingSession>('FittingSession', FittingSessionSchema)

// ==================== Router ====================
const fittingRoom = new Hono<AppEnv>()

// Tất cả route cần đăng nhập
fittingRoom.use('/*', authMiddleware)

// ==================== POST /fitting-room/body-profile — Nhập thông số cơ thể ====================
// SD: Quản lý phòng thử đồ → "Nhập thông số cơ thể" → "Gửi thông số" → "Trả kết quả" → "Hình ảnh model"
// Bước 1 trong flow: User nhập thông số → server trả về hình ảnh model 3D dựa trên body
// Body: { height, weight, chest?, waist?, hip? }
fittingRoom.post('/body-profile', async (c) => {
  try {
    const userId = c.get('userId')
    const { height, weight, chest, waist, hip } = await c.req.json()

    // Validate thông số cơ thể
    if (!height || !weight) {
      return c.json({ error: 'Vui lòng nhập chiều cao (height) và cân nặng (weight)' }, 400)
    }

    // Tính BMI để xác định body type → chọn hình ảnh model phù hợp
    const bmi = weight / ((height / 100) ** 2)
    let bodyType = 'average'
    let modelImageUrl = ''

    if (bmi < 18.5) {
      bodyType = 'slim'
      modelImageUrl = '/models/body-slim.png'
    } else if (bmi < 25) {
      bodyType = 'average'
      modelImageUrl = '/models/body-average.png'
    } else if (bmi < 30) {
      bodyType = 'large'
      modelImageUrl = '/models/body-large.png'
    } else {
      bodyType = 'plus'
      modelImageUrl = '/models/body-plus.png'
    }

    // Lưu/cập nhật thông số cơ thể vào user profile (optional)
    await User.findByIdAndUpdate(userId, {
      body_measurements: {
        height,
        weight,
        chest: chest || 0,
        waist: waist || 0,
        hip: hip || 0,
        bmi: Math.round(bmi * 10) / 10,
        bodyType,
      },
    })

    // TODO: Tích hợp AI 3D model rendering thật (Three.js server, ReadyPlayerMe API,...)
    // Tạm thời trả về model image URL dựa trên body type
    return c.json({
      message: 'Đã nhận thông số cơ thể!',
      bodyProfile: {
        height,
        weight,
        chest: chest || 0,
        waist: waist || 0,
        hip: hip || 0,
        bmi: Math.round(bmi * 10) / 10,
        bodyType,
        modelImageUrl, // SD: "Hình ảnh model" trả về cho user
      },
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi xử lý thông số cơ thể' }, 500)
  }
})

// ==================== POST /fitting-room/try — Thử đồ ====================
// SD: "Chọn đồ" → "Gửi thông số" → "Trả kết quả" → "Nhận xét từ AI"
// Body: { product_id, height, weight, chest?, waist?, hip? }
fittingRoom.post('/try', async (c) => {
  try {
    const userId = c.get('userId')
    const { product_id, height, weight, chest, waist, hip } = await c.req.json()

    // 1. Validate thông tin người dùng
    if (!product_id || !height || !weight) {
      return c.json({ error: 'Vui lòng nhập đủ: product_id, chiều cao (height), cân nặng (weight)' }, 400)
    }

    // 2. Chọn quần áo — kiểm tra SP tồn tại
    const product = await Product.findById(product_id)
    if (!product) {
      return c.json({ error: 'Sản phẩm không tồn tại' }, 404)
    }

    // 3. Nhận đánh giá từ AI
    // TODO: Tích hợp AI thật (OpenAI API, TensorFlow Serving,...)
    // Tạm thời: logic gợi ý size đơn giản dựa trên BMI + chiều cao
    const bmi = weight / ((height / 100) ** 2)
    let recommended_size = 'M'
    let fit_score = 75
    let ai_comment = ''

    if (bmi < 18.5) {
      recommended_size = 'S'
      fit_score = 85
      ai_comment = `Bạn có chỉ số BMI ${bmi.toFixed(1)} (gầy). Gợi ý size S cho sản phẩm "${product.name}". Sản phẩm sẽ vừa vặn với dáng người mảnh.`
    } else if (bmi < 23) {
      recommended_size = 'M'
      fit_score = 90
      ai_comment = `Bạn có chỉ số BMI ${bmi.toFixed(1)} (cân đối). Gợi ý size M cho sản phẩm "${product.name}". Đây là size phù hợp nhất!`
    } else if (bmi < 25) {
      recommended_size = 'L'
      fit_score = 80
      ai_comment = `Bạn có chỉ số BMI ${bmi.toFixed(1)} (hơi thừa cân). Gợi ý size L cho sản phẩm "${product.name}".`
    } else if (bmi < 30) {
      recommended_size = 'XL'
      fit_score = 75
      ai_comment = `Bạn có chỉ số BMI ${bmi.toFixed(1)} (thừa cân). Gợi ý size XL cho sản phẩm "${product.name}".`
    } else {
      recommended_size = 'XXL'
      fit_score = 70
      ai_comment = `Bạn có chỉ số BMI ${bmi.toFixed(1)}. Gợi ý size XXL cho sản phẩm "${product.name}".`
    }

    // Điều chỉnh theo chiều cao
    if (height > 175 && recommended_size === 'M') {
      recommended_size = 'L'
      ai_comment += ' (Chiều cao trên 175cm nên tăng 1 size cho thoải mái)'
    }
    if (height < 160 && recommended_size === 'M') {
      recommended_size = 'S'
      ai_comment += ' (Chiều cao dưới 160cm nên giảm 1 size cho vừa vặn)'
    }

    // 4. Lưu lịch sử thử đồ
    const session = await FittingSession.create({
      user_id: userId,
      product_id: product_id,
      user_height: height,
      user_weight: weight,
      user_chest: chest || 0,
      user_waist: waist || 0,
      user_hip: hip || 0,
      recommended_size,
      fit_score,
      ai_comment,
    })

    return c.json({
      message: 'Đánh giá thử đồ hoàn tất!',
      result: {
        product: {
          id: product._id,
          name: product.name,
          image: product.image_url,
        },
        recommended_size,
        fit_score,
        ai_comment,
        session_id: session._id,
      },
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi thử đồ' }, 500)
  }
})

// ==================== GET /fitting-room/history — Lịch sử thử đồ ====================
fittingRoom.get('/history', async (c) => {
  try {
    const userId = c.get('userId')

    const history = await FittingSession.find({ user_id: userId })
      .populate('product_id', 'name image_url price discount_price')
      .sort({ created_at: -1 })
      .limit(20)

    return c.json({ history })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy lịch sử thử đồ' }, 500)
  }
})

// ==================== ADMIN: Quản lý phòng thay đồ ====================

// GET /fitting-room/admin/products — Xem danh sách hình ảnh 3D
// SD: Admin quản lý phòng thử đồ → "Xem danh sách hình ảnh 3D" → "Trả kết quả"
// Hiển thị SP có hình ảnh 3D + thống kê số lần thử + size phổ biến
fittingRoom.get('/admin/products', adminMiddleware, async (c) => {
  try {
    // Lấy tất cả sản phẩm có/chưa có hình ảnh 3D
    const products = await Product.find({ is_active: true })
      .select('name image_url model_3d_url price stock')
      .sort({ name: 1 })

    // Aggregate: thống kê số lần thử đồ + size phổ biến cho mỗi SP
    const stats = await FittingSession.aggregate([
      {
        $group: {
          _id: '$product_id',
          totalTries: { $sum: 1 },                    // Tổng lượt thử
          avgFitScore: { $avg: '$fit_score' },         // Điểm fit trung bình
          sizes: { $push: '$recommended_size' },       // Danh sách size đã gợi ý
        },
      },
    ])

    // Map stats vào products
    const statsMap = new Map(stats.map((s) => [s._id.toString(), s]))

    const result = products.map((product) => {
      const stat = statsMap.get(product._id.toString())
      let mostPopularSize = 'N/A'
      let sizeDistribution: Record<string, number> = {}

      if (stat) {
        // Đếm tần suất mỗi size
        for (const size of stat.sizes) {
          sizeDistribution[size] = (sizeDistribution[size] || 0) + 1
        }
        mostPopularSize = Object.entries(sizeDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
      }

      return {
        productId: product._id,
        productName: product.name,
        productImage: product.image_url,
        model3dUrl: product.model_3d_url || null,  // SD: "danh sách hình ảnh 3D"
        has3dModel: !!product.model_3d_url,
        price: product.price,
        stock: product.stock,
        totalTries: stat?.totalTries || 0,
        avgFitScore: stat ? Math.round(stat.avgFitScore) : 0,
        mostPopularSize,
        sizeDistribution,
      }
    })

    return c.json({ products: result })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy danh sách hình ảnh 3D' }, 500)
  }
})

// PUT /fitting-room/admin/products/:id — Cập nhật hình ảnh 3D
// SD: Admin quản lý phòng thử đồ → [Cập nhật hình ảnh 3D] → "Cập nhật hình ảnh 3D" → "Lưu" → "Trả kết quả"
// Body: { model_3d_url } — URL hình ảnh 3D mới (hoặc các field khác)
fittingRoom.put('/admin/products/:id', adminMiddleware, async (c) => {
  try {
    const productId = c.req.param('id')
    const body = await c.req.json()

    // SD: Cập nhật hình ảnh 3D → Lưu
    // Admin có thể cập nhật: model_3d_url, available_sizes, fit_type,...
    const product = await Product.findByIdAndUpdate(productId, body, { new: true })
      .select('name image_url model_3d_url price stock')
    if (!product) {
      return c.json({ error: 'Không tìm thấy sản phẩm' }, 404)
    }

    return c.json({
      message: 'Cập nhật hình ảnh 3D thành công!',
      product: {
        id: product._id,
        name: product.name,
        image_url: product.image_url,
        model_3d_url: product.model_3d_url,
        has3dModel: !!product.model_3d_url,
      },
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi cập nhật hình ảnh 3D' }, 500)
  }
})

export default fittingRoom
