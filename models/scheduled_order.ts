import mongoose, { Document, Schema } from 'mongoose';

export interface IScheduledOrder extends Document {
  _id: string;
  creator_id: string;
  type: string;
  amount: number;
  fiat_amount: number[];
  fiat_code: string;
  payment_method: string;
  price_margin: number;
  community_id?: string;
  // Weekdays (0=Sunday .. 6=Saturday, UTC) on which the order is published
  days: number[];
  // Hour of the day (0-23, UTC) at which the order is published
  hour: number;
  // Remaining publication cycles before the schedule is exhausted
  republish_count: number;
  // The last order published from this schedule (mold -> order link)
  last_order_id?: string | null;
  active: boolean;
  created_at: Date;
}

const scheduledOrderSchema = new Schema<IScheduledOrder>({
  creator_id: { type: String, required: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  fiat_amount: { type: [Number], required: true },
  fiat_code: { type: String, required: true },
  payment_method: { type: String, required: true },
  price_margin: { type: Number, default: 0 },
  community_id: { type: String },
  days: { type: [Number], required: true },
  hour: { type: Number, required: true, min: 0, max: 23 },
  republish_count: { type: Number, default: 0 },
  last_order_id: { type: String, default: null },
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
});

export default mongoose.model<IScheduledOrder>(
  'ScheduledOrder',
  scheduledOrderSchema,
);
