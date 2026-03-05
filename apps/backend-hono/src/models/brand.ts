import mongoose, { Schema, Document } from 'mongoose'

export interface IBrand extends Document {
  name: string
  slug: string
  logo_url: string
  description: string
}

const BrandSchema = new Schema<IBrand>({
  name: { type: String, required: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true, maxlength: 200 },
  logo_url: { type: String, maxlength: 500 },
  description: { type: String, maxlength: 200 },
})

export const Brand = mongoose.model<IBrand>('Brand', BrandSchema)
