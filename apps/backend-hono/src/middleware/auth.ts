// Middleware xác thực JWT
// Middleware = "bảo vệ cửa" - kiểm tra user đã đăng nhập chưa trước khi cho vào route
// Flow: Client gửi token trong Header → Middleware kiểm tra → Cho phép hoặc từ chối

import type { Context, Next } from 'hono'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'tmf-secret-key-dev'

// Interface cho payload trong JWT token
// Khi user đăng nhập thành công, server tạo token chứa thông tin này
interface JwtPayload {
  userId: string
  role: string
}

// ==================== Middleware xác thực đăng nhập ====================
// Dùng cho các route cần đăng nhập (VD: xem giỏ hàng, đặt hàng,...)
// Cách dùng: authMiddleware (gắn vào route cần bảo vệ)
export const authMiddleware = async (c: Context, next: Next) => {
  // Lấy token từ Header: "Authorization: Bearer <token>"
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Chưa đăng nhập. Vui lòng gửi token trong header Authorization' }, 401)
  }

  const token = authHeader.split(' ')[1] // Tách lấy phần token sau "Bearer "

  try {
    // Giải mã token → lấy ra userId và role
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload
    // Lưu thông tin user vào context để các route phía sau dùng được
    c.set('userId', decoded.userId)
    c.set('role', decoded.role)
    await next() // Cho phép đi tiếp vào route
  } catch (error) {
    return c.json({ error: 'Token không hợp lệ hoặc đã hết hạn' }, 401)
  }
}

// ==================== Middleware kiểm tra quyền Admin ====================
// Dùng cho các route chỉ Admin mới được truy cập (VD: quản lý sản phẩm, xem doanh thu,...)
// Phải dùng SAU authMiddleware (vì cần có thông tin role từ token)
export const adminMiddleware = async (c: Context, next: Next) => {
  const role = c.get('role')

  if (role !== 'admin') {
    return c.json({ error: 'Bạn không có quyền truy cập. Chỉ Admin mới được phép.' }, 403)
  }

  await next()
}

// Helper: Tạo JWT token (dùng khi đăng nhập/đăng ký thành công)
export const generateToken = (userId: string, role: string): string => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' }) // Token hết hạn sau 7 ngày
}

export { JWT_SECRET }
