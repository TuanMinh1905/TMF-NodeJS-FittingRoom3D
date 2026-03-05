// Product Schema
import mongoose, { Schema, Document, Types } from 'mongoose'

// Extends là kế thừa từ lớp Document của Mongoose, để có thêm mấy cái thuộc tính như
// _id, createdAt, updatedAt, save(), remove(),....
export interface IProduct extends Document {
  name: string
  title: string
  alias: string
  sku: string
  price: number
  compare_at_price: number
  description: string
  image_url: string
  model_3d_url: string     // SD: Admin quản lý phòng thử đồ → hình ảnh 3D
  rating: number
  review_count: number
  stock: number
  is_active: boolean
  category_id: Types.ObjectId // FK -> Category
  brand_id: Types.ObjectId   // FK -> Brand
  created_at: Date
  updated_at: Date
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, maxlength: 200 },
    title: { type: String, maxlength: 200 },
    alias: { type: String, maxlength: 200 },
    sku: { type: String, unique: true, maxlength: 50 },
    price: { type: Number, required: true },
    compare_at_price: { type: Number, default: 0 },       // Giá gốc (trước giảm)
    description: { type: String, maxlength: 200 },
    image_url: { type: String, maxlength: 500 },
    model_3d_url: { type: String, maxlength: 500 }, // Hình ảnh 3D cho phòng thử đồ
    rating: { type: Number, default: 0, min: 0, max: 5 },
    review_count: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    brand_id: { type: Schema.Types.ObjectId, ref: 'Brand', required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

export const Product = mongoose.model<IProduct>('Product', ProductSchema)

//Tôi đang hiểu rằng cái interface là tạo ra cái kiểu dữ liệu cho Product.
// ProductSchema là ta định nghĩa cái collection ở MongoDB cho Product ( Tức là ta tạo ra một bảng tên là Product với 4 thuộc tính đó bao gồm 3 cột đầu là bắt buộc còn cột cuối không bắt buộc ).
// Mongoose.model() chưa tạo collection ngay. Nó chỉ tạo "bản vẽ" (model).
// Lúc này collection "products" CHƯA có trong MongoDB Compass
// const Product = mongoose.model('Product', ProductSchema)
// Lúc này MongoDB mới tạo collection "products"
// await Product.create({ name: 'Áo', price: 100000, description: 'Áo đẹp' })
// Tóm lại :
// interface → Kiểu dữ liệu TypeScript (chỉ dùng lúc code, không ảnh hưởng DB)
// Schema → Cấu trúc document trong MongoDB
// model() → Tạo "class" để thao tác với collection (find, create, update, delete)
// Collection thật → Tạo khi insert data đầu tiên