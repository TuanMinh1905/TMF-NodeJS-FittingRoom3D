import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IImage extends Document {
  url: string
  product_id: Types.ObjectId // FK -> Product
}

const ImageSchema = new Schema<IImage>({
  url: { type: String, required: true, maxlength: 500 },
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
})

export const Image = mongoose.model<IImage>('Image', ImageSchema)
