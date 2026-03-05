// ==================== CART ROUTES ====================
// Use Case: Quản lý giỏ hàng
// - Xem giỏ hàng (GET /cart)
// - Thêm sản phẩm vào giỏ (POST /cart/items)
// - Cập nhật số lượng (PUT /cart/items/:itemId)
// - Xóa sản phẩm khỏi giỏ (DELETE /cart/items/:itemId)
// - Xóa toàn bộ giỏ hàng (DELETE /cart)
//
// Logic: Mỗi user có 1 Cart duy nhất (tạo tự động khi thêm SP đầu tiên)
//        Mỗi SP chỉ xuất hiện 1 lần trong cart (compound unique index cart_id + product_id)
//        Nếu thêm SP đã có → tăng quantity

import { Hono } from 'hono'
import { Cart, CartItem } from '../models/cart.js'
import { Product } from '../models/product.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AppEnv } from '../types/env.js'

const cart = new Hono<AppEnv>()

// Tất cả route giỏ hàng đều cần đăng nhập
cart.use('/*', authMiddleware)

// ==================== GET /cart — Xem giỏ hàng ====================
// Trả về danh sách sản phẩm trong giỏ + tổng tiền
cart.get('/', async (c) => {
  try {
    const userId = c.get('userId')

    // Tìm cart của user (1 user : 1 cart)
    const userCart = await Cart.findOne({ user_id: userId })

    if (!userCart) {
      // Chưa có giỏ hàng → trả về giỏ rỗng
      return c.json({
        items: [],
        totalItems: 0,
        totalAmount: 0,
      })
    }

    // Lấy tất cả items trong cart, populate thông tin sản phẩm
    const items = await CartItem.find({ cart_id: userCart._id })
      .populate('product_id', 'name price compare_at_price stock image_url') // Chỉ lấy các field cần thiết
      .sort({ created_at: -1 }) // Mới thêm lên đầu

    // Tính tổng tiền
    // price = giá bán hiện tại, compare_at_price = giá gốc (nếu có giảm giá)
    let totalAmount = 0
    const cartItems = items.map((item) => {
      const product = item.product_id as any
      const unitPrice = product?.price || 0
      const originalPrice = product?.compare_at_price || product?.price || 0
      const subtotal = unitPrice * item.quantity

      totalAmount += subtotal

      return {
        _id: item._id,
        product: product,
        quantity: item.quantity,
        unitPrice,
        originalPrice, // Giá gốc (trước giảm), dùng để hiện strikethrough
        subtotal, // Thành tiền = đơn giá × số lượng
      }
    })

    return c.json({
      items: cartItems,
      totalItems: cartItems.length,
      totalAmount, // Tổng hóa đơn (Use Case: "Xem tổng hóa đơn")
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy giỏ hàng' }, 500)
  }
})

// ==================== POST /cart/items — Thêm sản phẩm vào giỏ ====================
// Body: { product_id, quantity }
// Nếu SP đã có trong giỏ → tăng quantity (không duplicate)
cart.post('/items', async (c) => {
  try {
    const userId = c.get('userId')
    const { product_id, quantity = 1 } = await c.req.json()

    if (!product_id) {
      return c.json({ error: 'Thiếu product_id' }, 400)
    }

    // Kiểm tra sản phẩm tồn tại và còn hàng
    const product = await Product.findById(product_id)
    if (!product) {
      return c.json({ error: 'Sản phẩm không tồn tại' }, 404)
    }
    if (product.stock < quantity) {
      return c.json({ error: `Sản phẩm chỉ còn ${product.stock} trong kho` }, 400)
    }

    // Tìm hoặc tạo Cart cho user (upsert pattern)
    // findOneAndUpdate + upsert: tìm cart, nếu chưa có thì tạo mới
    let userCart = await Cart.findOneAndUpdate(
      { user_id: userId },
      { user_id: userId },
      { upsert: true, new: true }
    )

    // Kiểm tra SP đã có trong giỏ chưa
    const existingItem = await CartItem.findOne({
      cart_id: userCart._id,
      product_id: product_id,
    })

    if (existingItem) {
      // Đã có → tăng quantity
      const newQuantity = existingItem.quantity + quantity
      if (newQuantity > product.stock) {
        return c.json({ error: `Không thể thêm. Tổng số lượng vượt quá kho (${product.stock})` }, 400)
      }
      existingItem.quantity = newQuantity
      await existingItem.save()
      return c.json({ message: 'Đã cập nhật số lượng trong giỏ hàng', item: existingItem })
    }

    // Chưa có → tạo CartItem mới
    const newItem = await CartItem.create({
      cart_id: userCart._id,
      product_id: product_id,
      quantity,
    })

    return c.json({ message: 'Đã thêm vào giỏ hàng', item: newItem }, 201)
  } catch (error) {
    return c.json({ error: 'Lỗi khi thêm vào giỏ hàng' }, 500)
  }
})

// ==================== PUT /cart/items/:itemId — Cập nhật số lượng ====================
// Use Case: "Tùy chỉnh đơn hàng" → Thay đổi số lượng SP trong giỏ
// Body: { quantity }
cart.put('/items/:itemId', async (c) => {
  try {
    const userId = c.get('userId')
    const itemId = c.req.param('itemId')
    const { quantity } = await c.req.json()

    if (!quantity || quantity < 1) {
      return c.json({ error: 'Số lượng phải >= 1' }, 400)
    }

    // Tìm cart của user
    const userCart = await Cart.findOne({ user_id: userId })
    if (!userCart) {
      return c.json({ error: 'Giỏ hàng không tồn tại' }, 404)
    }

    // Tìm CartItem thuộc cart của user (bảo mật: không cho sửa cart người khác)
    const item = await CartItem.findOne({ _id: itemId, cart_id: userCart._id })
    if (!item) {
      return c.json({ error: 'Không tìm thấy sản phẩm trong giỏ hàng' }, 404)
    }

    // Kiểm tra tồn kho
    const product = await Product.findById(item.product_id)
    if (product && quantity > product.stock) {
      return c.json({ error: `Sản phẩm chỉ còn ${product.stock} trong kho` }, 400)
    }

    item.quantity = quantity
    await item.save()

    return c.json({ message: 'Đã cập nhật số lượng', item })
  } catch (error) {
    return c.json({ error: 'Lỗi khi cập nhật giỏ hàng' }, 500)
  }
})

// ==================== DELETE /cart/items/:itemId — Xóa 1 SP khỏi giỏ ====================
cart.delete('/items/:itemId', async (c) => {
  try {
    const userId = c.get('userId')
    const itemId = c.req.param('itemId')

    const userCart = await Cart.findOne({ user_id: userId })
    if (!userCart) {
      return c.json({ error: 'Giỏ hàng không tồn tại' }, 404)
    }

    // Chỉ xóa item thuộc cart của chính user
    const deleted = await CartItem.findOneAndDelete({ _id: itemId, cart_id: userCart._id })
    if (!deleted) {
      return c.json({ error: 'Không tìm thấy sản phẩm trong giỏ hàng' }, 404)
    }

    return c.json({ message: 'Đã xóa sản phẩm khỏi giỏ hàng' })
  } catch (error) {
    return c.json({ error: 'Lỗi khi xóa sản phẩm khỏi giỏ' }, 500)
  }
})

// ==================== DELETE /cart — Xóa toàn bộ giỏ hàng ====================
cart.delete('/', async (c) => {
  try {
    const userId = c.get('userId')

    const userCart = await Cart.findOne({ user_id: userId })
    if (!userCart) {
      return c.json({ error: 'Giỏ hàng không tồn tại' }, 404)
    }

    // Xóa tất cả CartItem trước, sau đó xóa Cart
    await CartItem.deleteMany({ cart_id: userCart._id })
    await Cart.findByIdAndDelete(userCart._id)

    return c.json({ message: 'Đã xóa toàn bộ giỏ hàng' })
  } catch (error) {
    return c.json({ error: 'Lỗi khi xóa giỏ hàng' }, 500)
  }
})

export default cart
