// ==================== ORDER ROUTES ====================
// Use Case: Quản lý mua hàng + Thanh toán + Quản lý đơn hàng (Admin)
//
// === Customer ===
// - Đặt hàng / Checkout (POST /orders) — chuyển giỏ hàng thành đơn hàng + chọn phương thức thanh toán
// - Xác nhận thanh toán (PUT /orders/:id/confirm-payment) — SD: Quản lý thanh toán
// - Xem danh sách đơn hàng (GET /orders)
// - Xem chi tiết đơn hàng (GET /orders/:id)
// - Hủy đơn hàng (PUT /orders/:id/cancel) — chỉ hủy được khi status = 'pending'
//
// === Admin ===
// - Xem tất cả đơn hàng (GET /orders/admin/all)
// - Cập nhật trạng thái đơn hàng (PUT /orders/:id/status)
//
// SD: Quản lý thanh toán Flow:
// 1. Nhập thông tin thanh toán (shipping_address, phone)
// 2. Chọn phương thức thanh toán (payment_method: cod/credit_card/e_wallet/bank_transfer)
// 3. Gửi yêu cầu thanh toán → Xác nhận → Lưu thông tin → Xóa giỏ hàng
// 4. Admin xác nhận → shipping → delivered

import { Hono } from 'hono'
import { Order, OrderItem } from '../models/order.js'
import { Cart, CartItem } from '../models/cart.js'
import { Product } from '../models/product.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { getShippingZone, calculateShippingFee } from '../data/vietnam-shipping.js'
import type { AppEnv } from '../types/env.js'

const orders = new Hono<AppEnv>()

// Tất cả route đơn hàng cần đăng nhập
orders.use('/*', authMiddleware)

// ==================== POST /orders — Đặt hàng (Checkout) ====================
// Use Case: "Thanh toán" — Chuyển giỏ hàng thành đơn hàng
// Body: { shipping_address, shipping_province, shipping_district, phone, payment_method, shipping_method?, note? }
// SD: Quản lý thanh toán:
//   1. Nhập thông tin (shipping_address, shipping_province, shipping_district, phone)
//   2. Chọn phương thức vận chuyển (shipping_method: standard/fast/express)
//   3. Tính phí ship theo vùng (noi_thanh/ngoai_thanh/lan_can/trong_nuoc/vung_xa)
//   4. Chọn phương thức thanh toán (payment_method)
//   5. Gửi yêu cầu thanh toán → Tính phí ship → Lưu thông tin → Xóa giỏ hàng
// Flow: Lấy giỏ hàng → Tính tiền hàng → Xác định zone ship → Tính phí ship → Tạo Order → Tạo OrderItem → Giảm stock → Xóa giỏ

orders.post('/', async (c) => {
  try {
    const userId = c.get('userId')
    const { shipping_address, shipping_province, shipping_district, phone, payment_method, shipping_method, note } = await c.req.json()

    // Validate input
    if (!shipping_address || !phone || !shipping_province || !shipping_district) {
      return c.json({ error: 'Thiếu thông tin giao hàng (tỉnh/thành, quận/huyện, địa chỉ, SĐT)' }, 400)
    }

    // SD: Chọn phương thức thanh toán — validate
    const validPaymentMethods = ['cod', 'credit_card', 'e_wallet', 'bank_transfer']
    const selectedPayment = payment_method || 'cod' // Mặc định COD
    if (!validPaymentMethods.includes(selectedPayment)) {
      return c.json({ error: `Phương thức thanh toán không hợp lệ. Chọn: ${validPaymentMethods.join(', ')}` }, 400)
    }

    // Lấy giỏ hàng của user
    const userCart = await Cart.findOne({ user_id: userId })
    if (!userCart) {
      return c.json({ error: 'Giỏ hàng trống, không thể đặt hàng' }, 400)
    }

    const cartItems = await CartItem.find({ cart_id: userCart._id }).populate('product_id')
    if (cartItems.length === 0) {
      return c.json({ error: 'Giỏ hàng trống, không thể đặt hàng' }, 400)
    }

    // Tính tổng tiền + kiểm tra tồn kho + chuẩn bị OrderItem
    let totalAmount = 0
    const orderItemsData = []

    for (const item of cartItems) {
      const product = item.product_id as any

      if (!product) continue

      // Kiểm tra còn hàng không
      if (product.stock < item.quantity) {
        return c.json({
          error: `Sản phẩm "${product.name}" chỉ còn ${product.stock} trong kho`,
        }, 400)
      }

      // Snapshot giá tại thời điểm đặt hàng (quan trọng!)
      // → Nếu sau này giá SP thay đổi, đơn hàng cũ vẫn giữ nguyên giá lúc mua
      const snapshotPrice = product.price
      const subtotal = snapshotPrice * item.quantity
      totalAmount += subtotal

      orderItemsData.push({
        product_id: product._id,
        quantity: item.quantity,
        price: snapshotPrice, // Giá snapshot
      })
    }

    // SD: Tính phí vận chuyển theo vùng (zone)
    // 1. Xác định zone từ tỉnh/TP + quận/huyện
    // 2. Tính phí theo zone × phương thức
    // 3. Áp dụng miễn phí nếu đạt ngưỡng theo zone
    const selectedShipping = shipping_method || 'standard'
    const validShippingMethods = ['standard', 'fast', 'express']
    if (!validShippingMethods.includes(selectedShipping)) {
      return c.json({ error: `Phương thức vận chuyển không hợp lệ. Chọn: ${validShippingMethods.join(', ')}` }, 400)
    }

    const zone = getShippingZone(shipping_province, shipping_district)
    const shippingFee = calculateShippingFee(zone, selectedShipping, totalAmount)

    // Phương thức không hỗ trợ cho vùng này (VD: express ở vùng xa)
    if (shippingFee === -1) {
      return c.json({ error: `Phương thức "${selectedShipping}" không hỗ trợ khu vực này. Vui lòng chọn phương thức khác.` }, 400)
    }

    // Tổng thanh toán = tiền hàng + phí ship
    const grandTotal = totalAmount + shippingFee

    // SD: Lưu thông tin thanh toán → Tạo Order với payment_method + shipping
    const order = await Order.create({
      user_id: userId,
      status: 'pending',
      total_amount: grandTotal,
      shipping_address,
      shipping_province,
      shipping_district,
      shipping_zone: zone,
      shipping_method: selectedShipping,
      shipping_fee: shippingFee,
      phone,
      payment_method: selectedPayment,
      payment_status: selectedPayment === 'cod' ? 'pending' : 'confirmed',
      note: note || '',
    })

    // Tạo OrderItems (gắn order_id)
    const orderItems = await OrderItem.insertMany(
      orderItemsData.map((item) => ({
        ...item,
        order_id: order._id,
      }))
    )

    // Giảm stock (trừ tồn kho)
    for (const item of orderItemsData) {
      await Product.findByIdAndUpdate(item.product_id, {
        $inc: { stock: -item.quantity }, // $inc: tăng/giảm giá trị field
      })
    }

    // Xóa giỏ hàng sau khi đặt hàng thành công
    await CartItem.deleteMany({ cart_id: userCart._id })
    await Cart.findByIdAndDelete(userCart._id)

    // SD: Thông báo thanh toán thành công, Xóa giỏ hàng ✅
    return c.json({
      message: 'Đặt hàng thành công! Thanh toán đã được xác nhận.',
      order: {
        _id: order._id,
        status: order.status,
        total_amount: order.total_amount,
        shipping_address: order.shipping_address,
        shipping_province: order.shipping_province,
        shipping_district: order.shipping_district,
        shipping_zone: order.shipping_zone,
        shipping_method: order.shipping_method,
        shipping_fee: order.shipping_fee,
        phone: order.phone,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        note: order.note,
        items: orderItems,
        created_at: order.created_at,
      },
    }, 201)
  } catch (error) {
    return c.json({ error: 'Lỗi khi đặt hàng' }, 500)
  }
})

// ==================== GET /orders — Danh sách đơn hàng của user ====================
// Use Case: "Xem lịch sử mua hàng"
orders.get('/', async (c) => {
  try {
    const userId = c.get('userId')

    const userOrders = await Order.find({ user_id: userId })
      .sort({ created_at: -1 }) // Mới nhất lên đầu

    return c.json({ orders: userOrders })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy danh sách đơn hàng' }, 500)
  }
})

// ==================== GET /orders/admin/all — Admin xem tất cả đơn hàng ====================
// Use Case: "Quản lý đơn hàng" (Admin)
// Hỗ trợ filter theo status: ?status=pending
orders.get('/admin/all', adminMiddleware, async (c) => {
  try {
    const status = c.req.query('status')
    const page = Number(c.req.query('page')) || 1
    const limit = Number(c.req.query('limit')) || 20

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = {}
    if (status) filter.status = status

    const [allOrders, total] = await Promise.all([
      Order.find(filter)
        .populate('user_id', 'full_name email') // Hiển thị tên + email khách hàng
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ])

    return c.json({
      orders: allOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy danh sách đơn hàng' }, 500)
  }
})

// ==================== GET /orders/:id — Chi tiết đơn hàng ====================
orders.get('/:id', async (c) => {
  try {
    const userId = c.get('userId')
    const role = c.get('role')
    const orderId = c.req.param('id')

    const order = await Order.findById(orderId).populate('user_id', 'full_name email')

    if (!order) {
      return c.json({ error: 'Không tìm thấy đơn hàng' }, 404)
    }

    // Bảo mật: User thường chỉ xem được đơn hàng của mình
    // Admin có thể xem tất cả
    if (role !== 'admin' && order.user_id.toString() !== userId) {
      return c.json({ error: 'Bạn không có quyền xem đơn hàng này' }, 403)
    }

    // Lấy danh sách sản phẩm trong đơn hàng
    const items = await OrderItem.find({ order_id: orderId })
      .populate('product_id', 'name image_url') // Tên + ảnh SP

    return c.json({
      order,
      items,
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy chi tiết đơn hàng' }, 500)
  }
})

// ==================== PUT /orders/:id/status — Admin cập nhật trạng thái ====================
// Use Case: "Quản lý đơn hàng" → Admin xác nhận / vận chuyển / giao hàng
// Body: { status } — Giá trị: 'confirmed', 'shipping', 'delivered', 'cancelled'
// Flow trạng thái: pending → confirmed → shipping → delivered
//                  pending → cancelled (hủy)
orders.put('/:id/status', adminMiddleware, async (c) => {
  try {
    const orderId = c.req.param('id')
    const { status } = await c.req.json()

    const validStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled']
    if (!validStatuses.includes(status)) {
      return c.json({ error: `Trạng thái không hợp lệ. Chọn: ${validStatuses.join(', ')}` }, 400)
    }

    const order = await Order.findById(orderId)
    if (!order) {
      return c.json({ error: 'Không tìm thấy đơn hàng' }, 404)
    }

    // Không cho cập nhật đơn đã giao hoặc đã hủy
    if (order.status === 'delivered') {
      return c.json({ error: 'Đơn hàng đã giao, không thể thay đổi trạng thái' }, 400)
    }
    if (order.status === 'cancelled') {
      return c.json({ error: 'Đơn hàng đã hủy, không thể thay đổi trạng thái' }, 400)
    }

    // Nếu Admin hủy đơn → hoàn lại stock
    if (status === 'cancelled') {
      const items = await OrderItem.find({ order_id: orderId })
      for (const item of items) {
        await Product.findByIdAndUpdate(item.product_id, {
          $inc: { stock: item.quantity }, // Hoàn stock
        })
      }
    }

    order.status = status
    await order.save()

    return c.json({ message: `Đã cập nhật trạng thái thành "${status}"`, order })
  } catch (error) {
    return c.json({ error: 'Lỗi khi cập nhật trạng thái' }, 500)
  }
})

// ==================== PUT /orders/:id/cancel — User hủy đơn hàng ====================
// Chỉ cho phép hủy khi đơn hàng đang ở trạng thái 'pending'
orders.put('/:id/cancel', async (c) => {
  try {
    const userId = c.get('userId')
    const orderId = c.req.param('id')

    const order = await Order.findById(orderId)
    if (!order) {
      return c.json({ error: 'Không tìm thấy đơn hàng' }, 404)
    }

    // Chỉ user sở hữu mới được hủy
    if (order.user_id.toString() !== userId) {
      return c.json({ error: 'Bạn không có quyền hủy đơn hàng này' }, 403)
    }

    // Chỉ hủy được khi còn 'pending' (chưa xác nhận)
    if (order.status !== 'pending') {
      return c.json({ error: 'Chỉ có thể hủy đơn hàng đang chờ xác nhận (pending)' }, 400)
    }

    // Hoàn lại stock khi hủy
    const items = await OrderItem.find({ order_id: orderId })
    for (const item of items) {
      await Product.findByIdAndUpdate(item.product_id, {
        $inc: { stock: item.quantity },
      })
    }

    order.status = 'cancelled'
    await order.save()

    return c.json({ message: 'Đã hủy đơn hàng thành công', order })
  } catch (error) {
    return c.json({ error: 'Lỗi khi hủy đơn hàng' }, 500)
  }
})

// ==================== PUT /orders/:id/confirm-payment — Xác nhận thanh toán ====================
// SD: Quản lý thanh toán → "Xác nhận thanh toán" → "Lưu thông tin thanh toán"
// Dùng cho các phương thức thanh toán online (credit_card, e_wallet, bank_transfer)
// COD thì tự động confirmed khi admin chuyển trạng thái delivered
orders.put('/:id/confirm-payment', async (c) => {
  try {
    const userId = c.get('userId')
    const orderId = c.req.param('id')
    const { transaction_id } = await c.req.json()

    const order = await Order.findById(orderId)
    if (!order) {
      return c.json({ error: 'Không tìm thấy đơn hàng' }, 404)
    }

    // Bảo mật: chỉ chủ đơn hàng mới xác nhận được
    if (order.user_id.toString() !== userId) {
      return c.json({ error: 'Bạn không có quyền xác nhận thanh toán cho đơn hàng này' }, 403)
    }

    // Chỉ xác nhận khi payment_status đang pending
    if (order.payment_status === 'confirmed') {
      return c.json({ error: 'Đơn hàng đã được thanh toán rồi' }, 400)
    }

    // SD: Xác nhận thanh toán → Lưu thông tin thanh toán
    order.payment_status = 'confirmed'
    await order.save()

    return c.json({
      message: 'Xác nhận thanh toán thành công!',
      order: {
        _id: order._id,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        total_amount: order.total_amount,
      },
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi xác nhận thanh toán' }, 500)
  }
})

export default orders
