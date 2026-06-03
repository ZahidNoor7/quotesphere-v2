import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITimeEntry extends Document {
  project_id: mongoose.Types.ObjectId;
  user_id?: mongoose.Types.ObjectId;
  user_name?: string;
  date: Date;
  hours: number;
  description: string;
  hourly_rate: number;
  currency: string;
  billed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const timeEntrySchema = new Schema<ITimeEntry>(
  {
    project_id:  { type: Schema.Types.ObjectId, ref: "Project", required: true },
    user_id:     { type: Schema.Types.ObjectId, ref: "User" },
    user_name:   { type: String },
    date:        { type: Date, required: true, default: Date.now },
    hours:       { type: Number, required: true, min: 0.01 },
    description: { type: String, required: true, maxlength: 500 },
    hourly_rate: { type: Number, default: 0, min: 0 },
    currency:    { type: String, default: "PKR" },
    billed:      { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

timeEntrySchema.index({ project_id: 1, date: -1 });

const TimeEntry: Model<ITimeEntry> =
  mongoose.models.TimeEntry || mongoose.model<ITimeEntry>("TimeEntry", timeEntrySchema);

export default TimeEntry;
