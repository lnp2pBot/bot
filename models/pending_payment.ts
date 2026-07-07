import mongoose, { Document, Schema } from 'mongoose';

export interface IPendingPayment extends Document {
  description: string;
  amount: number;
  // Lightning routing fee paid for this payment, in satoshis. Mainly relevant
  // for community earnings withdrawals, which have no associated order to hold
  // the fee (see issue #867).
  fee: number;
  attempts: number;
  paid: boolean;
  is_invoice_expired: boolean;
  payment_request: string;
  hash: string;
  created_at: Date;
  paid_at: Date;
  user_id: string;
  order_id: string;
  community_id: string;
  last_error: string;
  next_retry: Date;
}

const PendingPaymentSchema = new Schema<IPendingPayment>({
  description: { type: String },
  amount: {
    // amount in satoshis
    type: Number,
    min: [1, 'Minimum amount is 1 sat'],
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value',
    },
  },
  fee: { type: Number, min: 0, default: 0 },
  attempts: { type: Number, min: 0, default: 0 },
  paid: { type: Boolean, default: false },
  is_invoice_expired: { type: Boolean, default: false },
  payment_request: { type: String },
  hash: { type: String },
  created_at: { type: Date, default: Date.now },
  paid_at: { type: Date },
  user_id: { type: String },
  order_id: { type: String },
  community_id: { type: String },
  last_error: { type: String, default: '' },
  next_retry: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 60 * 1000),
  },
});

export default mongoose.model<IPendingPayment>(
  'PendingPayment',
  PendingPaymentSchema,
);
