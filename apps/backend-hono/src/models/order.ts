import mongoose, { Schema, Document, Types } from 'mongoose'

// ==================== Order ====================
export interface IOrder extends Document {
  user_id: Types.ObjectId // FK -> User
  status: string
  total_amount: number
  shipping_address: string
  shipping_province: string // Mã tỉnh/TP (VD: 'HCM', 'HN')
  shipping_district: string // Tên quận/huyện
  shipping_method: string  // standard, fast, express
  shipping_fee: number     // Phí vận chuyển tại thời điểm đặt hàng
  shipping_zone: string    // Zone tại thời điểm đặt hàng
  phone: string
  note: string
  payment_method: string   // SD: Quản lý thanh toán → Chọn phương thức thanh toán
  payment_status: string   // Trạng thái thanh toán: pending, confirmed, failed
  created_at: Date
  updated_at: Date
}

const OrderSchema = new Schema<IOrder>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      required: true,
      default: 'pending',
      maxlength: 200,
      enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
    },
    total_amount: { type: Number, required: true },
    shipping_address: { type: String, required: true, maxlength: 500 },
    // Tỉnh/TP + Quận/Huyện (dùng để tính zone ship)
    shipping_province: { type: String, required: true, maxlength: 10 }, // Mã tỉnh: 'HCM', 'HN',...
    shipping_district: { type: String, required: true, maxlength: 100 }, // Tên quận/huyện
    // Phương thức vận chuyển + phí ship (snapshot tại thời điểm đặt hàng)
    shipping_zone: { type: String, maxlength: 20 }, // Zone đã tính: noi_thanh, ngoai_thanh,...
    shipping_method: {
      type: String,
      default: 'standard',
      enum: ['standard', 'fast', 'express'],
      // standard = giao tiêu chuẩn 3-5 ngày
      // fast = giao nhanh 1-2 ngày
      // express = hỏa tốc 2-4 giờ
    },
    shipping_fee: { type: Number, default: 0 }, // Phí ship đã tính (đã trừ miễn phí nếu có)
    phone: { type: String, required: true, maxlength: 20 },
    note: { type: String, maxlength: 500 },
    // SD: Quản lý thanh toán → Chọn phương thức thanh toán
    payment_method: {
      type: String,
      default: 'cod',
      enum: ['cod', 'credit_card', 'e_wallet', 'bank_transfer'],
      // cod = thanh toán khi nhận hàng
      // credit_card = thẻ tín dụng
      // e_wallet = ví điện tử (MoMo, ZaloPay,...)
      // bank_transfer = chuyển khoản ngân hàng
    },
    // Trạng thái thanh toán (tách riêng với trạng thái đơn hàng)
    payment_status: {
      type: String,
      default: 'pending',
      enum: ['pending', 'confirmed', 'failed'],
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

export const Order = mongoose.model<IOrder>('Order', OrderSchema)

// ==================== OrderItem ====================
export interface IOrderItem extends Document {
  order_id: Types.ObjectId   // FK -> Order
  product_id: Types.ObjectId // FK -> Product
  quantity: number
  price: number              // Giá tại thời điểm đặt hàng (snapshot)
}

const OrderItemSchema = new Schema<IOrderItem>({
  order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
})

export const OrderItem = mongoose.model<IOrderItem>('OrderItem', OrderItemSchema)
