import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { connect } from 'mongoose'
import { connectDB } from './db/mongoose.js'
import products from './routes/product.js'

const app = new Hono()

connectDB() // Hàm này ở folder db . Tên file là mongoose.ts á

app.get('/', (c) => {
  return c.text('route gốc, c.text là khi gọi API này sẽ trả về cái text thôi')
})

// Gắn router products vào đường dẫn /products
app.route('/products', products) // Gắn route products vào app chính

const port = Number(process.env.PORT) || 8000
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 Server running at http://localhost:${info.port}`)
})
