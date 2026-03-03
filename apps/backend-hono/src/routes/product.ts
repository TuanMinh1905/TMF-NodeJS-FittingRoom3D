// API Routes
import { Hono } from 'hono'
// Trong ts config có cái dòng "module": "NodeNext" nên khi import thì phải có đuôi .js mới không báo lỗi
// Source code: product.ts
// Khi build: TypeScript compile thành product.js
// Khi chạy: Node.js đọc file .js
// Nên import path phải là .js để Node.js tìm được
import { Product } from '../models/product.js'

// Tạo router riêng cho products
const products = new Hono()

// Ở đây là dựng API tạo nè
products.get('/', async (c) => {
    const allProducts = await Product.find() // Lấy tất cả sản phẩm từ MongoDB
    return c.json(allProducts) // Trả về JSON cho client
})

// Thử tự làm thêm cái API get sản phẩm theo id 
// c đối tượng chứa thông tin request và các method để trả response.
products.get('/:id', async (c) => {
    const { id } = c.req.param() // Lúc này đang tìm hiểu c là gì, thì c.req.param() là lấy tham số id từ URL. Ví dụ: /products/123 thì id sẽ là 123
    const product = await Product.findById(id) // Tìm sản phẩm theo id trong MongoDB 
    return c.json(product)
})

// API POST tạo sản phẩm mới
products.post('/', async (c) => {
    const newproduct = await c.req.json() 
    const createdProduct = await Product.create(newproduct) // Tạo sản phẩm mới trong MongoDB
    return c.json(createdProduct, 201)
})

export default products