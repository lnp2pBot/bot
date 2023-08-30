import mongoose, { Document, Schema } from 'mongoose';

export interface IPendingPayment extends Document {
    description: string;
    amount: number;
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
});


module.exports = mongoose.model<IPendingPayment>('PendingPayment', PendingPaymentSchema);
