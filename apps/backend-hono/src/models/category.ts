import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ICategory extends Document {
  name: string
  parent_id: Types.ObjectId | null // Tự tham chiếu chính nó (category cha)
  sortOrder: number
  slug: string
  isActive: boolean
  created_at: Date
  updated_at: Date
  url_image: string
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, maxlength: 200 },
    parent_id: { type: Schema.Types.ObjectId, ref: 'Category', default: null }, // Category cha (null = root)
    sortOrder: { type: Number, default: 0 },
    slug: { type: String, required: true, unique: true, maxlength: 200 },
    isActive: { type: Boolean, default: true },
    url_image: { type: String, maxlength: 500 },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

export const Category = mongoose.model<ICategory>('Category', CategorySchema)
