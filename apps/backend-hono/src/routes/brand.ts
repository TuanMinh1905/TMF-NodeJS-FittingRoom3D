// ==================== BRAND ROUTES ====================
// Use Case Admin: Xem danh sách thương hiệu <<extend>> Xem chi tiết
//                 Cập nhật thương hiệu (thêm, xóa, sửa) <<include>> Lưu
//
// GET    /brands          → Xem danh sách thương hiệu (public)
// GET    /brands/:id      → Xem chi tiết thương hiệu (public)
// POST   /brands          → Thêm thương hiệu (Admin)
// PUT    /brands/:id      → Sửa thương hiệu (Admin)
// DELETE /brands/:id      → Xóa thương hiệu (Admin)

import { Hono } from 'hono'
import { Brand } from '../models/brand.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const brands = new Hono()

// ==================== GET: Danh sách thương hiệu ====================
brands.get('/', async (c) => {
  try {
    const allBrands = await Brand.find().sort({ name: 1 }) // Sắp xếp theo tên A-Z
    return c.json({ data: allBrands })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy danh sách thương hiệu' }, 500)
  }
})

// ==================== GET: Chi tiết thương hiệu ====================
brands.get('/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const brand = await Brand.findById(id)

    if (!brand) {
      return c.json({ error: 'Không tìm thấy thương hiệu' }, 404)
    }

    return c.json({ data: brand })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy chi tiết thương hiệu' }, 500)
  }
})

// ==================== POST: Thêm thương hiệu (Admin) ====================
brands.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const created = await Brand.create(body)
    return c.json({ message: 'Tạo thương hiệu thành công!', data: created }, 201)
  } catch (error: any) {
    return c.json({ error: 'Lỗi khi tạo thương hiệu', detail: error.message }, 400)
  }
})

// ==================== PUT: Sửa thương hiệu (Admin) ====================
brands.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const updated = await Brand.findByIdAndUpdate(id, body, { new: true })

    if (!updated) {
      return c.json({ error: 'Không tìm thấy thương hiệu' }, 404)
    }

    return c.json({ message: 'Cập nhật thương hiệu thành công!', data: updated })
  } catch (error: any) {
    return c.json({ error: 'Lỗi khi cập nhật thương hiệu', detail: error.message }, 400)
  }
})

// ==================== DELETE: Xóa thương hiệu (Admin) ====================
brands.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const deleted = await Brand.findByIdAndDelete(id)

    if (!deleted) {
      return c.json({ error: 'Không tìm thấy thương hiệu' }, 404)
    }

    return c.json({ message: 'Xóa thương hiệu thành công!' })
  } catch (error) {
    return c.json({ error: 'Lỗi khi xóa thương hiệu' }, 500)
  }
})

export default brands
