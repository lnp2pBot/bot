import mongoose, { Document, Schema } from 'mongoose';

interface UserReview {
  rating: number;
  reviewed_at: Date;
}

export interface UserDocument extends Document {
   _id: string;
  tg_id: string;
  username?: string;
  lang: string;
  trades_completed: number;
  total_reviews: number;
  last_rating: number;
  total_rating: number;
  reviews: UserReview[];
  volume_traded: number;
  admin: boolean;
  banned: boolean;
  show_username: boolean;
  show_volume_traded: boolean;
  lightning_address?: string | null;
  nostr_public_key?: string;
  disputes: number;
  created_at: Date;
  default_community_id?: string;
}

const UserReviewSchema = new Schema<UserReview>({
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewed_at: { type: Date, default: Date.now },
});

const UserSchema = new Schema<UserDocument>({
  tg_id: { type: String, unique: true },
  username: { type: String },
  lang: { type: String, default: 'en' },
  trades_completed: { type: Number, min: 0, default: 0 },
  total_reviews: { type: Number, min: 0, default: 0 },
  last_rating: { type: Number, min: 0, max: 5, default: 0 },
  total_rating: { type: Number, min: 0, max: 5, default: 0 },
  reviews: [UserReviewSchema],
  volume_traded: { type: Number, min: 0, default: 0 },
  admin: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },
  show_username: { type: Boolean, default: false },
  show_volume_traded: { type: Boolean, default: false },
  lightning_address: { type: String },
  nostr_public_key: { type: String },
  disputes: { type: Number, min: 0, default: 0 },
  created_at: { type: Date, default: Date.now },
  default_community_id: { type: String },
});

export default mongoose.model<UserDocument>('User', UserSchema);
