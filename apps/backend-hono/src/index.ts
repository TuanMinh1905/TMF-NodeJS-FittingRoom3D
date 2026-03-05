import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { connect } from 'mongoose'
import { connectDB } from './db/mongoose.js'

// Import tất cả route modules
import products from './routes/product.js'
import auth from './routes/auth.js'
import categories from './routes/category.js'
import brands from './routes/brand.js'
import cart from './routes/cart.js'
import orders from './routes/order.js'
import adminUsers from './routes/admin-user.js'
import revenue from './routes/admin-revenue.js'
import fittingRoom from './routes/fitting-room.js'

const app = new Hono()

// Cho phép frontend (localhost:3000) gọi API qua browser
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:3005'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

connectDB() // Hàm này ở folder db . Tên file là mongoose.ts á

app.get('/', (c) => {
  return c.text('route gốc, c.text là khi gọi API này sẽ trả về cái text thôi')
})

// ==================== Đăng ký Routes ====================
// Public + Auth routes
app.route('/auth', auth)             // Đăng ký, đăng nhập, quên MK
app.route('/products', products)     // Gắn route products vào app chính
app.route('/categories', categories) // Danh mục sản phẩm
app.route('/brands', brands)         // Thương hiệu

// Protected routes (cần đăng nhập)
app.route('/cart', cart)             // Giỏ hàng
app.route('/orders', orders)         // Đơn hàng
app.route('/fitting-room', fittingRoom) // Phòng thay đồ / Thử đồ + AI

// Admin routes (cần đăng nhập + role admin)
app.route('/users', adminUsers)      // Quản lý tài khoản
app.route('/admin/revenue', revenue) // Quản lý doanh thu

const port = Number(process.env.PORT) || 8000
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Server running at http://localhost:${info.port}`)
})
