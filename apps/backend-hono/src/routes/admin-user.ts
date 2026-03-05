// ==================== ADMIN USER MANAGEMENT ROUTES ====================
// Use Case: Quản lý tài khoản (Admin)
// - Xem danh sách tài khoản (GET /admin/users)
// - Xem chi tiết tài khoản (GET /admin/users/:id)
// - Cập nhật tài khoản (PUT /admin/users/:id)
// - Xóa tài khoản (DELETE /admin/users/:id)
// - Xem thông tin cá nhân (GET /admin/users/me) — user tự xem
// - Cập nhật thông tin cá nhân (PUT /admin/users/me) — user tự sửa
//
// Tất cả route prefix /admin/users → chỉ Admin mới truy cập được
// Ngoại trừ /me routes → user thường cũng dùng được

import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { User } from '../models/user.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types/env.js'

const adminUsers = new Hono<AppEnv>()

// Tất cả route đều cần đăng nhập
adminUsers.use('/*', authMiddleware)

// ==================== GET /users/me — User xem thông tin cá nhân ====================
// Mọi user đã đăng nhập đều dùng được (không cần admin)
adminUsers.get('/me', async (c) => {
  try {
    const userId = c.get('userId')

    // Không trả về password_hash (select('-password_hash'))
    const user = await User.findById(userId).select('-password_hash')

    if (!user) {
      return c.json({ error: 'Không tìm thấy tài khoản' }, 404)
    }

    return c.json({ user })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy thông tin cá nhân' }, 500)
  }
})

// ==================== PUT /users/me — User cập nhật thông tin cá nhân ====================
// Body: { full_name?, email? }
// Không cho phép tự đổi role (chỉ Admin mới đổi được)
adminUsers.put('/me', async (c) => {
  try {
    const userId = c.get('userId')
    const { full_name, email } = await c.req.json()

    const updateData: Record<string, string> = {}
    if (full_name) updateData.full_name = full_name
    if (email) {
      // Kiểm tra email trùng
      const existing = await User.findOne({ email, _id: { $ne: userId } })
      if (existing) {
        return c.json({ error: 'Email đã được sử dụng bởi tài khoản khác' }, 400)
      }
      updateData.email = email
    }

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true })
      .select('-password_hash')

    return c.json({ message: 'Cập nhật thông tin thành công', user })
  } catch (error) {
    return c.json({ error: 'Lỗi khi cập nhật thông tin' }, 500)
  }
})

// ==================== Các route bên dưới: CHỈ ADMIN ====================

// ==================== POST /users — Admin tạo tài khoản mới ====================
// SD: Quản lý tài khoản → "Thêm tài khoản" → Lưu thông tin → Thông báo thành công
// Body: { email, password, full_name, role? }
adminUsers.post('/', adminMiddleware, async (c) => {
  try {
    const { email, password, full_name, role } = await c.req.json()

    // Validate input
    if (!email || !password || !full_name) {
      return c.json({ error: 'Vui lòng điền đầy đủ email, password và họ tên' }, 400)
    }

    // Kiểm tra email trùng — SD: [TK đã tồn tại] → "Yêu cầu nhập lại"
    const existing = await User.findOne({ email })
    if (existing) {
      return c.json({ error: 'Email đã tồn tại. Vui lòng chọn email khác.' }, 409)
    }

    // Mã hóa password
    const password_hash = await bcrypt.hash(password, 10)

    // Lưu thông tin → Database
    const user = await User.create({
      email,
      password_hash,
      full_name,
      role: role || 'customer', // Admin có thể chỉ định role
    })

    return c.json({
      message: 'Tạo tài khoản thành công!',
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    }, 201)
  } catch (error) {
    return c.json({ error: 'Lỗi khi tạo tài khoản' }, 500)
  }
})

// ==================== GET /users — Danh sách tất cả tài khoản ====================
// Use Case: "Xem danh sách tài khoản"
// Hỗ trợ: ?page, ?limit, ?keyword (tìm theo tên/email), ?role (filter)
adminUsers.get('/', adminMiddleware, async (c) => {
  try {
    const page = Number(c.req.query('page')) || 1
    const limit = Number(c.req.query('limit')) || 20
    const keyword = c.req.query('keyword')
    const role = c.req.query('role')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {}

    // Tìm kiếm theo tên hoặc email
    if (keyword) {
      filter.$or = [
        { full_name: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
      ]
    }

    // Lọc theo role
    if (role) filter.role = role

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password_hash') // Không trả password
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ])

    return c.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy danh sách tài khoản' }, 500)
  }
})

// ==================== GET /users/:id — Chi tiết tài khoản ====================
adminUsers.get('/:id', adminMiddleware, async (c) => {
  try {
    const userId = c.req.param('id')

    const user = await User.findById(userId).select('-password_hash')
    if (!user) {
      return c.json({ error: 'Không tìm thấy tài khoản' }, 404)
    }

    return c.json({ user })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy thông tin tài khoản' }, 500)
  }
})

// ==================== PUT /users/:id — Admin cập nhật tài khoản ====================
// Body: { full_name?, email?, role? }
// Admin có thể đổi role (user ↔ admin)
adminUsers.put('/:id', adminMiddleware, async (c) => {
  try {
    const userId = c.req.param('id')
    const { full_name, email, role } = await c.req.json()

    const updateData: Record<string, string> = {}
    if (full_name) updateData.full_name = full_name
    if (role) updateData.role = role

    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: userId } })
      if (existing) {
        return c.json({ error: 'Email đã được sử dụng bởi tài khoản khác' }, 400)
      }
      updateData.email = email
    }

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true })
      .select('-password_hash')

    if (!user) {
      return c.json({ error: 'Không tìm thấy tài khoản' }, 404)
    }

    return c.json({ message: 'Cập nhật tài khoản thành công', user })
  } catch (error) {
    return c.json({ error: 'Lỗi khi cập nhật tài khoản' }, 500)
  }
})

// ==================== DELETE /users/:id — Admin xóa tài khoản ====================
// Không cho Admin xóa chính mình
adminUsers.delete('/:id', adminMiddleware, async (c) => {
  try {
    const targetId = c.req.param('id')
    const currentUserId = c.get('userId')

    // Bảo vệ: không cho admin tự xóa mình
    if (targetId === currentUserId) {
      return c.json({ error: 'Không thể xóa tài khoản của chính mình' }, 400)
    }

    const user = await User.findByIdAndDelete(targetId)
    if (!user) {
      return c.json({ error: 'Không tìm thấy tài khoản' }, 404)
    }

    return c.json({ message: 'Đã xóa tài khoản thành công' })
  } catch (error) {
    return c.json({ error: 'Lỗi khi xóa tài khoản' }, 500)
  }
})

export default adminUsers
