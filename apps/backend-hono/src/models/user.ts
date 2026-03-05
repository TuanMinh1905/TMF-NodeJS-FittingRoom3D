import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IUser extends Document {
  email: string
  password_hash: string
  full_name: string
  role: string
  created_at: Date
  updated_at: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, maxlength: 200 },
    password_hash: { type: String, required: true, maxlength: 200 },
    full_name: { type: String, required: true, maxlength: 100 },
    role: { type: String, required: true, default: 'customer', maxlength: 20 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

export const User = mongoose.model<IUser>('User', UserSchema)
