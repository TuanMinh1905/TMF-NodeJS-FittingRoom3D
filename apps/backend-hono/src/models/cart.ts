import mongoose, { Schema, Document, Types } from 'mongoose'

// ==================== Cart ====================
export interface ICart extends Document {
  user_id: Types.ObjectId // FK -> User (1 user : 1 cart)
  created_at: Date
  updated_at: Date
}

const CartSchema = new Schema<ICart>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

export const Cart = mongoose.model<ICart>('Cart', CartSchema)

// ==================== CartItem ====================
export interface ICartItem extends Document {
  cart_id: Types.ObjectId    // FK -> Cart
  product_id: Types.ObjectId // FK -> Product
  quantity: number
  created_at: Date
  updated_at: Date
}

const CartItemSchema = new Schema<ICartItem>(
  {
    cart_id: { type: Schema.Types.ObjectId, ref: 'Cart', required: true },
    product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

// Đảm bảo 1 sản phẩm chỉ xuất hiện 1 lần trong 1 cart (tăng quantity thay vì duplicate)
CartItemSchema.index({ cart_id: 1, product_id: 1 }, { unique: true })

export const CartItem = mongoose.model<ICartItem>('CartItem', CartItemSchema)
