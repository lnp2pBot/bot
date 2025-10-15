import mongoose, { Document, Schema } from 'mongoose';

export interface IFinancialTransaction extends Document {
  order_id: string;
  transaction_type: 'order_completed' | 'community_payment';
  timestamp: Date;

  // Fees collected
  total_fee: number;
  bot_fee_earned: number;
  community_fee_allocated: number;
  community_id: string | null;

  // Operational costs
  routing_fee_paid: number;

  // Net balance
  net_profit: number;

  // Metadata
  is_golden_honey_badger: boolean;
  order_amount_sats: number;
}

const financialTransactionSchema = new Schema<IFinancialTransaction>({
  order_id: { type: String, required: true, index: true },
  transaction_type: {
    type: String,
    required: true,
    enum: ['order_completed', 'community_payment'],
  },
  timestamp: { type: Date, default: Date.now, index: true },

  // Fees collected
  total_fee: { type: Number, required: true, min: 0 },
  bot_fee_earned: { type: Number, required: true, min: 0 },
  community_fee_allocated: { type: Number, required: true, min: 0 },
  community_id: { type: String, default: null },

  // Operational costs
  routing_fee_paid: { type: Number, required: true, min: 0, default: 0 },

  // Net balance
  net_profit: { type: Number, required: true },

  // Metadata
  is_golden_honey_badger: { type: Boolean, default: false },
  order_amount_sats: { type: Number, required: true, min: 0 },
});

// Compound index for date range queries
financialTransactionSchema.index({ timestamp: 1, transaction_type: 1 });

export default mongoose.model<IFinancialTransaction>(
  'FinancialTransaction',
  financialTransactionSchema,
);
