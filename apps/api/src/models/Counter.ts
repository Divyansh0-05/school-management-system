import mongoose, { Schema, Document, Model } from 'mongoose';
export interface ICounter extends Document { key: string; value: number; }
const counterSchema = new Schema<ICounter>({ key: { type: String, unique: true }, value: { type: Number, default: 0 } });
export const Counter: Model<ICounter> = mongoose.models.Counter || mongoose.model<ICounter>('Counter', counterSchema, 'counters');
