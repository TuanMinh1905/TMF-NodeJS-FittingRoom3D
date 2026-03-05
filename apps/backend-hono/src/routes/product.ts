// ==================== PRODUCT ROUTES ====================
// Use Case Admin: Xem danh sách sản phẩm, Cập nhật sản phẩm (thêm, xóa, sửa) <<include>> Lưu
// Use Case Khách hàng: Tìm kiếm sản phẩm (từ khóa, danh mục, thương hiệu), Xem chi tiết
//
// GET    /products          → Xem danh sách + tìm kiếm + lọc (ai cũng xem được)
// GET    /products/:id      → Xem chi tiết sản phẩm
// POST   /products          → Thêm sản phẩm mới (Admin)
// PUT    /products/:id      → Sửa sản phẩm (Admin)
// DELETE /products/:id      → Xóa sản phẩm (Admin)

import { Hono } from 'hono'
// Trong ts config có cái dòng "module": "NodeNext" nên khi import thì phải có đuôi .js mặc dù source code là .ts
// Source code: product.ts
// Khi build: TypeScript compile thành product.js
// Khi chạy: Node.js đọc file .js
// Nên import path phải là .js để Node.js tìm được
import { Product } from '../models/product.js'
import { Image } from '../models/image.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

// Tạo router riêng cho products
const products = new Hono()

// ==================== GET: Danh sách + Tìm kiếm + Lọc ====================
// Use Case: Tìm kiếm sản phẩm bằng từ khóa, Lọc theo danh mục, Lọc theo thương hiệu
// Query params: ?keyword=áo&category_id=xxx&brand_id=xxx&page=1&limit=10
products.get('/', async (c) => {
  try {
    const { keyword, category_id, brand_id, page = '1', limit = '10' } = c.req.query()

    // Xây dựng bộ lọc (filter) dựa trên query params
    const filter: any = { is_active: true } // Chỉ lấy sản phẩm đang bán

    // Tìm kiếm bằng từ khóa (tìm trong name và description)
    // $regex: tìm kiếm theo pattern, $options: 'i' = không phân biệt hoa thường
    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
      ]
    }

    // Lọc theo danh mục
    if (category_id) filter.category_id = category_id
    // Lọc theo thương hiệu
    if (brand_id) filter.brand_id = brand_id

    // Tính phân trang
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Đếm tổng số sản phẩm thỏa filter
    const total = await Product.countDocuments(filter)

    // Lấy danh sách sản phẩm + populate (join) tên category và brand
    const allProducts = await Product.find(filter)
      .populate('category_id', 'name slug')   // Lấy name & slug của category
      .populate('brand_id', 'name slug')       // Lấy name & slug của brand
      .skip(skip)
      .limit(limitNum)
      .sort({ created_at: -1 })                // Mới nhất lên trước

    return c.json({
      data: allProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy danh sách sản phẩm' }, 500)
  }
})

// ==================== GET: Chi tiết sản phẩm ====================
// Use Case: Xem chi tiết sản phẩm (<<extend>> từ danh sách)
products.get('/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const product = await Product.findById(id)
      .populate('category_id', 'name slug')
      .populate('brand_id', 'name slug logo_url')

    if (!product) {
      return c.json({ error: 'Không tìm thấy sản phẩm' }, 404)
    }

    // Lấy thêm danh sách ảnh phụ của sản phẩm (từ bảng Image)
    const images = await Image.find({ product_id: id })

    return c.json({ ...product.toObject(), images })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy chi tiết sản phẩm' }, 500)
  }
})

// ==================== POST: Thêm sản phẩm (Admin) ====================
// Use Case Admin: Cập nhật sản phẩm (thêm) <<include>> Lưu
// Phải đăng nhập + là Admin mới được dùng
products.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const createdProduct = await Product.create(body)
    return c.json({ message: 'Tạo sản phẩm thành công!', data: createdProduct }, 201)
  } catch (error: any) {
    return c.json({ error: 'Lỗi khi tạo sản phẩm', detail: error.message }, 400)
  }
})

// ==================== PUT: Sửa sản phẩm (Admin) ====================
// Use Case Admin: Cập nhật sản phẩm (sửa) <<include>> Lưu
products.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()

    // findByIdAndUpdate: tìm theo id và cập nhật, { new: true } trả về document sau khi update
    const updated = await Product.findByIdAndUpdate(id, body, { new: true })
    if (!updated) {
      return c.json({ error: 'Không tìm thấy sản phẩm' }, 404)
    }

    return c.json({ message: 'Cập nhật sản phẩm thành công!', data: updated })
  } catch (error: any) {
    return c.json({ error: 'Lỗi khi cập nhật sản phẩm', detail: error.message }, 400)
  }
})

// ==================== DELETE: Xóa sản phẩm (Admin) ====================
// Use Case Admin: Cập nhật sản phẩm (xóa)
products.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const deleted = await Product.findByIdAndDelete(id)
    if (!deleted) {
      return c.json({ error: 'Không tìm thấy sản phẩm' }, 404)
    }

    // Xóa luôn các ảnh phụ liên quan
    await Image.deleteMany({ product_id: id })

    return c.json({ message: 'Xóa sản phẩm thành công!' })
  } catch (error) {
    return c.json({ error: 'Lỗi khi xóa sản phẩm' }, 500)
  }
})

export default products