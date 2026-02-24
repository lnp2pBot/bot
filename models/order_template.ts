import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderTemplate extends Document {
  creator_id: string;
  type: 'buy' | 'sell';
  fiat_code: string;
  fiat_amount: number[];
  amount: number;
  payment_method: string;
  price_from_api: boolean;
  price_margin: number;
  created_at: Date;
  updated_at: Date;
}

const orderTemplateSchema = new Schema<IOrderTemplate>({
  creator_id: { type: String, required: true, index: true },
  type: { type: String, enum: ['buy', 'sell'], required: true },
  fiat_code: { type: String, required: true },
  fiat_amount: { type: [Number], required: true },
  amount: { type: Number, default: 0 },
  payment_method: { type: String, required: true },
  price_from_api: { type: Boolean, default: true },
  price_margin: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Update updated_at on save
orderTemplateSchema.pre('save', function (next) {
  this.updated_at = new Date();
  next();
});

export default mongoose.model<IOrderTemplate>(
  'OrderTemplate',
  orderTemplateSchema,
);
