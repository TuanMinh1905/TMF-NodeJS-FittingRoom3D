// ==================== ADMIN REVENUE / STATS ROUTES ====================
// Use Case: Quản lý doanh thu (Admin)
// - Xem tổng doanh thu (GET /admin/revenue) — theo ngày/tháng/năm
// - Top sản phẩm bán chạy (GET /admin/revenue/top-products)
// - Thống kê đơn hàng theo trạng thái (GET /admin/revenue/order-stats)
// - Doanh thu theo thời gian (GET /admin/revenue/chart) — cho biểu đồ
// - Tổng quan dashboard (GET /admin/revenue/overview)
//
// Sử dụng MongoDB Aggregation Pipeline
// Aggregation = "tổng hợp dữ liệu" → giống GROUP BY trong SQL
// Pipeline = chuỗi các bước xử lý dữ liệu: $match → $group → $sort → $project

import { Hono } from 'hono'
import { Order, OrderItem } from '../models/order.js'
import { User } from '../models/user.js'
import { Product } from '../models/product.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const revenue = new Hono()

// Tất cả route doanh thu: cần đăng nhập + là Admin
revenue.use('/*', authMiddleware, adminMiddleware)

// ==================== GET /admin/revenue/overview — Tổng quan Dashboard ====================
// Trả về: tổng doanh thu, tổng đơn hàng, tổng user, tổng sản phẩm
revenue.get('/overview', async (c) => {
  try {
    // Chạy song song 4 query để tăng tốc (Promise.all)
    const [
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
    ] = await Promise.all([
      // Tổng doanh thu = SUM(total_amount) của đơn hàng đã giao (delivered)
      Order.aggregate([
        { $match: { status: 'delivered' } },
        { $group: { _id: null, total: { $sum: '$total_amount' } } },
      ]),
      Order.countDocuments(),
      User.countDocuments(),
      Product.countDocuments(),
    ])

    return c.json({
      totalRevenue: totalRevenue[0]?.total || 0,
      totalOrders,
      totalUsers,
      totalProducts,
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy tổng quan' }, 500)
  }
})

// ==================== GET /admin/revenue — Tổng doanh thu ====================
// Query params:
//   ?period=day|month|year — khoảng thời gian thống kê
//   ?from=2024-01-01 — ngày bắt đầu
//   ?to=2024-12-31   — ngày kết thúc
revenue.get('/', async (c) => {
  try {
    const from = c.req.query('from')
    const to = c.req.query('to')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchStage: any = { status: 'delivered' } // Chỉ tính đơn đã giao

    // Filter theo khoảng thời gian
    if (from || to) {
      matchStage.created_at = {}
      if (from) matchStage.created_at.$gte = new Date(from)
      if (to) matchStage.created_at.$lte = new Date(to)
    }

    const result = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total_amount' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$total_amount' }, // Giá trị trung bình mỗi đơn
        },
      },
    ])

    return c.json({
      totalRevenue: result[0]?.totalRevenue || 0,
      orderCount: result[0]?.orderCount || 0,
      avgOrderValue: Math.round(result[0]?.avgOrderValue || 0),
      period: { from, to },
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi tính doanh thu' }, 500)
  }
})

// ==================== GET /admin/revenue/compare — So sánh doanh thu tháng hiện tại vs tháng trước ====================
// SD: Quản lý doanh thu → "Xem doanh thu tháng so với tháng trước" → Kết quả
// Query: ?month=6&year=2024 (default: tháng hiện tại)
// Trả về: doanh thu tháng này, doanh thu tháng trước, % tăng/giảm
revenue.get('/compare', async (c) => {
  try {
    const now = new Date()
    const month = Number(c.req.query('month')) || (now.getMonth() + 1) // 1-12
    const year = Number(c.req.query('year')) || now.getFullYear()

    // Tháng hiện tại: đầu tháng → cuối tháng
    const currentMonthStart = new Date(year, month - 1, 1) // month 0-indexed trong JS
    const currentMonthEnd = new Date(year, month, 1) // Đầu tháng sau = cuối tháng này

    // Tháng trước
    const prevMonthStart = new Date(year, month - 2, 1)
    const prevMonthEnd = new Date(year, month - 1, 1)

    // Chạy 2 query song song: doanh thu tháng này + tháng trước
    const [currentResult, prevResult] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            status: 'delivered',
            created_at: { $gte: currentMonthStart, $lt: currentMonthEnd },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total_amount' },
            orderCount: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            status: 'delivered',
            created_at: { $gte: prevMonthStart, $lt: prevMonthEnd },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total_amount' },
            orderCount: { $sum: 1 },
          },
        },
      ]),
    ])

    const currentRevenue = currentResult[0]?.revenue || 0
    const currentOrders = currentResult[0]?.orderCount || 0
    const prevRevenue = prevResult[0]?.revenue || 0
    const prevOrders = prevResult[0]?.orderCount || 0

    // Tính % thay đổi
    const revenueChange = prevRevenue > 0
      ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100 * 10) / 10
      : currentRevenue > 0 ? 100 : 0

    const orderChange = prevOrders > 0
      ? Math.round(((currentOrders - prevOrders) / prevOrders) * 100 * 10) / 10
      : currentOrders > 0 ? 100 : 0

    return c.json({
      currentMonth: {
        month,
        year,
        revenue: currentRevenue,
        orderCount: currentOrders,
      },
      previousMonth: {
        month: month === 1 ? 12 : month - 1,
        year: month === 1 ? year - 1 : year,
        revenue: prevRevenue,
        orderCount: prevOrders,
      },
      comparison: {
        revenueChange, // % thay đổi doanh thu (dương = tăng, âm = giảm)
        orderChange,   // % thay đổi số đơn hàng
        revenueDiff: currentRevenue - prevRevenue, // Chênh lệch tuyệt đối
      },
    })
  } catch (error) {
    return c.json({ error: 'Lỗi khi so sánh doanh thu' }, 500)
  }
})

// ==================== GET /admin/revenue/chart — Doanh thu theo thời gian ====================
// Use Case: "Biểu đồ so sánh"
// Query: ?period=day|month|year (default: month)
//        ?year=2024 (filter theo năm, default: năm hiện tại)
// Trả về array data points cho frontend vẽ biểu đồ
revenue.get('/chart', async (c) => {
  try {
    const period = c.req.query('period') || 'month'
    const year = Number(c.req.query('year')) || new Date().getFullYear()

    // Chỉ lấy đơn đã giao trong năm được chọn
    const matchStage = {
      status: 'delivered',
      created_at: {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${year + 1}-01-01`),
      },
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let groupId: any

    // Cấu hình group theo kỳ (ngày/tháng/năm)
    if (period === 'day') {
      // Group theo ngày: { year: 2024, month: 6, day: 15 }
      groupId = {
        year: { $year: '$created_at' },
        month: { $month: '$created_at' },
        day: { $dayOfMonth: '$created_at' },
      }
    } else if (period === 'year') {
      groupId = { year: { $year: '$created_at' } }
    } else {
      // Default: group theo tháng
      groupId = {
        year: { $year: '$created_at' },
        month: { $month: '$created_at' },
      }
    }

    const chartData = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupId,
          revenue: { $sum: '$total_amount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ])

    return c.json({ period, year, data: chartData })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy dữ liệu biểu đồ' }, 500)
  }
})

// ==================== GET /admin/revenue/top-products — Top SP bán chạy ====================
// Use Case: "Top sản phẩm bán chạy"
// Query: ?limit=10 (default: 10)
revenue.get('/top-products', async (c) => {
  try {
    const limit = Number(c.req.query('limit')) || 10

    // Aggregation trên OrderItem:
    // 1. Group theo product_id → tính tổng quantity + tổng doanh thu
    // 2. Sort theo totalSold giảm dần
    // 3. Lookup (JOIN) bảng Product để lấy tên + ảnh
    const topProducts = await OrderItem.aggregate([
      {
        $group: {
          _id: '$product_id',
          totalSold: { $sum: '$quantity' },         // Tổng số lượng bán
          totalRevenue: { $sum: { $multiply: ['$price', '$quantity'] } }, // Tổng doanh thu
        },
      },
      { $sort: { totalSold: -1 } }, // Nhiều nhất lên đầu
      { $limit: limit },
      {
        // $lookup = JOIN với collection Product để lấy thông tin SP
        $lookup: {
          from: 'products', // Tên collection (lowercase + 's')
          localField: '_id',
          foreignField: '_id',
          as: 'product', // Kết quả JOIN lưu vào field 'product'
        },
      },
      { $unwind: '$product' }, // $unwind: chuyển array 1 phần tử thành object
      {
        // $project: chọn fields muốn trả về (giống SELECT trong SQL)
        $project: {
          _id: 0,
          productId: '$_id',
          productName: '$product.name',
          productImage: '$product.image_url',
          totalSold: 1,
          totalRevenue: 1,
        },
      },
    ])

    return c.json({ topProducts })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy top sản phẩm' }, 500)
  }
})

// ==================== GET /admin/revenue/order-stats — Thống kê đơn hàng theo trạng thái ====================
revenue.get('/order-stats', async (c) => {
  try {
    // Group đơn hàng theo status → đếm số lượng mỗi loại
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total_amount' },
        },
      },
      { $sort: { count: -1 } },
    ])

    // Chuyển thành object dễ đọc hơn cho frontend
    const result: Record<string, { count: number; totalAmount: number }> = {}
    for (const item of stats) {
      result[item._id] = {
        count: item.count,
        totalAmount: item.totalAmount,
      }
    }

    return c.json({ orderStats: result })
  } catch (error) {
    return c.json({ error: 'Lỗi khi lấy thống kê đơn hàng' }, 500)
  }
})

// ==================== GET /admin/revenue/export — Xuất file CSV ====================
// Use Case: "Xuất file doanh thu"
// Trả về CSV format, frontend có thể download trực tiếp
revenue.get('/export', async (c) => {
  try {
    const from = c.req.query('from')
    const to = c.req.query('to')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchStage: any = { status: 'delivered' }
    if (from || to) {
      matchStage.created_at = {}
      if (from) matchStage.created_at.$gte = new Date(from)
      if (to) matchStage.created_at.$lte = new Date(to)
    }

    // Lấy tất cả đơn hàng đã giao + thông tin user
    const deliveredOrders = await Order.find(matchStage)
      .populate('user_id', 'full_name email')
      .sort({ created_at: -1 })

    // Tạo CSV content
    // Header row
    let csv = 'Mã đơn hàng,Khách hàng,Email,Tổng tiền,Địa chỉ,SĐT,Ngày đặt\n'

    // Data rows
    for (const order of deliveredOrders) {
      const user = order.user_id as any
      const row = [
        order._id,
        user?.full_name || 'N/A',
        user?.email || 'N/A',
        order.total_amount,
        `"${order.shipping_address}"`, // Wrap trong "" phòng trường hợp có dấu phẩy
        order.phone,
        order.created_at.toISOString().split('T')[0], // Format: YYYY-MM-DD
      ].join(',')
      csv += row + '\n'
    }

    // Trả về response dạng CSV file
    // Content-Disposition: attachment → trình duyệt sẽ tải file xuống
    c.header('Content-Type', 'text/csv; charset=utf-8')
    c.header('Content-Disposition', 'attachment; filename=revenue-report.csv')
    return c.body(csv)
  } catch (error) {
    return c.json({ error: 'Lỗi khi xuất báo cáo' }, 500)
  }
})

export default revenue
