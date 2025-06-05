import mongoose, { Document, Schema } from 'mongoose';

export interface IBlock extends Document {
  blocker_tg_id: string;
  blocked_tg_id: string;
  created_at: Date;
}

const blockSchema = new Schema<IBlock>({
  blocker_tg_id: { type: String, required: true, index: true },
  blocked_tg_id: { type: String, required: true, index: true },
  created_at: { type: Date, default: Date.now },
});

blockSchema.index({ blocker_tg_id: 1, blocked_tg_id: 1 }, { unique: true });

export default mongoose.model<IBlock>('Block', blockSchema);
