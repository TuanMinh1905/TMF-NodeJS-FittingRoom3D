// ==================== AUTH ROUTES ====================
// Use Case: Đăng ký, Đăng nhập, Quên mật khẩu
// 
// POST /auth/register   → Đăng ký tài khoản mới
// POST /auth/login      → Đăng nhập
// POST /auth/forgot-password → Gửi OTP reset password (tạm thời)
// POST /auth/reset-password  → Đặt lại password

import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { User } from '../models/user.js'
import { generateToken, authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types/env.js'

const auth = new Hono<AppEnv>()

// ==================== ĐĂNG KÝ ====================
// Use Case: Điền thông tin cá nhân → Xác nhận đăng ký
// Client gửi: { email, password, full_name }
// Server trả: { user, token }
auth.post('/register', async (c) => {
  try {
    const { email, password, full_name } = await c.req.json()

    // Validate: kiểm tra đã điền đủ thông tin chưa
    if (!email || !password || !full_name) {
      return c.json({ error: 'Vui lòng điền đầy đủ email, password và họ tên' }, 400)
    }

    // Validate email format (Activity Diagram: "Thông tin hợp lệ" check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return c.json({ error: 'Email không hợp lệ. Vui lòng điền lại.' }, 400)
    }

    // Validate password tối thiểu 6 ký tự
    if (password.length < 6) {
      return c.json({ error: 'Password phải có ít nhất 6 ký tự' }, 400)
    }

    // Kiểm tra email đã tồn tại chưa
    // Activity Diagram: "Thông tin trùng" → "Điền lại thông tin phù hợp"
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return c.json({ error: 'Email này đã được đăng ký. Vui lòng điền lại thông tin.' }, 409) // 409 = Conflict
    }

    // Mã hóa password (không bao giờ lưu password gốc vào DB!)
    // bcrypt.hash('123456', 10) → '$2a$10$abcxyz...' (chuỗi hash 60 ký tự)
    const password_hash = await bcrypt.hash(password, 10)

    // Tạo user mới trong MongoDB
    const user = await User.create({
      email,
      password_hash,
      full_name,
      role: 'customer', // Mặc định là customer, admin được set thủ công trong DB
    })

    // Tạo JWT token để user không phải đăng nhập lại
    const token = generateToken(user._id!.toString(), user.role)

    return c.json({
      message: 'Đăng ký thành công!',
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      token,
    }, 201)
  } catch (error) {
    return c.json({ error: 'Lỗi server khi đăng ký' }, 500)
  }
})

// ==================== ĐĂNG NHẬP ====================
// Use Case: Nhập Username/Password → <<include>> Xác thực thông tin đăng nhập
// Client gửi: { email, password }
// Server trả: { user, token }
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json()

    if (!email || !password) {
      return c.json({ error: 'Vui lòng điền email và password' }, 400)
    }

    // Tìm user theo email
    const user = await User.findOne({ email })
    if (!user) {
      return c.json({ error: 'Email hoặc password không đúng' }, 401)
    }

    // So sánh password gửi lên với password_hash trong DB
    // bcrypt.compare('123456', '$2a$10$abcxyz...') → true/false
    const isMatch = await bcrypt.compare(password, user.password_hash)
    if (!isMatch) {
      return c.json({ error: 'Email hoặc password không đúng' }, 401)
    }

    // Tạo token
    const token = generateToken(user._id!.toString(), user.role)

    return c.json({
      message: 'Đăng nhập thành công!',
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      token,
    })
  } catch (error) {
    return c.json({ error: 'Lỗi server khi đăng nhập' }, 500)
  }
})

// ==================== QUÊN MẬT KHẨU ====================
// Use Case: Nhập thông tin tài khoản → Gửi OTP → Xác thực mã → Đặt lại password
// Tạm thời implement đơn giản (chưa có gửi email OTP thật)
// Sau này sẽ tích hợp Nodemailer hoặc service email

// Bước 1: Nhập email → kiểm tra tồn tại
auth.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json()

    const user = await User.findOne({ email })
    if (!user) {
      return c.json({ error: 'Email không tồn tại trong hệ thống' }, 404)
    }

    // TODO: Gửi OTP qua email thật (Nodemailer, SendGrid,...)
    // Tạm thời: trả về message thành công
    return c.json({
      message: 'Đã gửi mã xác thực đến email của bạn (tính năng đang phát triển)',
      // Thực tế sẽ không trả OTP về client, chỉ gửi qua email
    })
  } catch (error) {
    return c.json({ error: 'Lỗi server' }, 500)
  }
})

// Bước 2: Đặt lại password (sau khi xác thực OTP)
auth.post('/reset-password', async (c) => {
  try {
    const { email, new_password } = await c.req.json()

    if (!email || !new_password) {
      return c.json({ error: 'Vui lòng điền email và password mới' }, 400)
    }

    const user = await User.findOne({ email })
    if (!user) {
      return c.json({ error: 'Email không tồn tại' }, 404)
    }

    // Mã hóa password mới và cập nhật
    user.password_hash = await bcrypt.hash(new_password, 10)
    await user.save()

    return c.json({ message: 'Đặt lại mật khẩu thành công!' })
  } catch (error) {
    return c.json({ error: 'Lỗi server' }, 500)
  }
})

// ==================== ĐĂNG XUẤT ====================
// Activity Diagram: Cả User và Admin đều kết thúc bằng "Đăng xuất"
// Với JWT, logout = client xóa token khỏi localStorage/cookie
// Server-side: trả về message xác nhận (optional: thêm blacklist token)
auth.post('/logout', authMiddleware, async (c) => {
  try {
    // JWT là stateless → server không lưu session
    // Logout = client tự xóa token ở phía frontend
    // Endpoint này dùng để:
    // 1. Frontend gọi confirm "đăng xuất thành công"
    // 2. Sau này có thể thêm token blacklist (Redis) để vô hiệu hóa token cũ
    return c.json({ message: 'Đăng xuất thành công!' })
  } catch (error) {
    return c.json({ error: 'Lỗi server khi đăng xuất' }, 500)
  }
})

export default auth
