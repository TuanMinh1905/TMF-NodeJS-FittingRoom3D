// Product Schema
import mongoose, { Schema, Document } from 'mongoose';

// Extends là kế thừa từ lớp Document của Mongoose, để có thêm mấy cái thuộc tính như
// _id, createdAt, updatedAt, save(), remove(),....
export interface IProduct extends Document {
    name: string;
    price: number;
    description: string;
    imageUrl: string;
}

const ProductSchema = new Schema<IProduct>(
    {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        description: { type: String, required: true },
        imageUrl: { type: String, required: false },
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