// ==================== CATEGORY ROUTES ====================
// Use Case Admin: Xem danh sách danh mục <<extend>> Xem chi tiết
//                 Cập nhật danh mục (thêm, xóa, sửa) <<include>> Lưu
//
// GET    /categories          → Xem danh sách danh mục (public)
// GET    /categories/:id      → Xem chi tiết danh mục (public)
// POST   /categories          → Thêm danh mục (Admin)
// PUT    /categories/:id      → Sửa danh mục (Admin)
// DELETE /categories/:id      → Xóa danh mục (Admin)

import { Hono } from 'hono'
import { Category } from '../models/category.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const categories = new Hono()

// ==================== GET: Danh sách danh mục ====================
// Ai cũng xem được (dùng cho menu, sidebar filter,...)
categories.get('/', async (c) => {
  try {
    // Lấy tất cả category đang active, populate parent_id để biết category cha
    const allCategories = await Category.find({ isActive: true })
      .populate('parent_id', 'name slug')
      .sort({ sortOrder: 1 }) // Sắp xếp theo thứ tự hiển thị

    return c.json({ data: allCategories })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy danh sách danh mục' }, 500)
  }
})

// ==================== GET: Chi tiết danh mục ====================
categories.get('/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const category = await Category.findById(id).populate('parent_id', 'name slug')

    if (!category) {
      return c.json({ error: 'Không tìm thấy danh mục' }, 404)
    }

    return c.json({ data: category })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy chi tiết danh mục' }, 500)
  }
})

// ==================== POST: Thêm danh mục (Admin) ====================
categories.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const created = await Category.create(body)
    return c.json({ message: 'Tạo danh mục thành công!', data: created }, 201)
  } catch (error: any) {
    return c.json({ error: 'Lỗi khi tạo danh mục', detail: error.message }, 400)
  }
})

// ==================== PUT: Sửa danh mục (Admin) ====================
categories.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const updated = await Category.findByIdAndUpdate(id, body, { new: true })

    if (!updated) {
      return c.json({ error: 'Không tìm thấy danh mục' }, 404)
    }

    return c.json({ message: 'Cập nhật danh mục thành công!', data: updated })
  } catch (error: any) {
    return c.json({ error: 'Lỗi khi cập nhật danh mục', detail: error.message }, 400)
  }
})

// ==================== DELETE: Xóa danh mục (Admin) ====================
categories.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const deleted = await Category.findByIdAndDelete(id)

    if (!deleted) {
      return c.json({ error: 'Không tìm thấy danh mục' }, 404)
    }

    return c.json({ message: 'Xóa danh mục thành công!' })
  } catch (error) {
    return c.json({ error: 'Lỗi khi xóa danh mục' }, 500)
  }
})

export default categories
