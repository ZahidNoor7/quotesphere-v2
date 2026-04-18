import mongoose, { Schema, Document, Model } from "mongoose";
import { getNextNumber } from "./Counter";

export interface IProject extends Document {
  project_no: string;
  name: string;
  description?: string;
  status: "pending" | "in_progress" | "on_hold" | "cancelled" | "complete";
  start_date?: Date;
  due_date?: Date;
  completed_at?: Date;
  budget: number;
  currency: string;
  customer_id: mongoose.Types.ObjectId;
  customer_name: string;
  customer_phone: string;
  tags?: string[];
  notes?: string;
  progress?: number;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    project_no: { type: String, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    status: {
      type: String,
      enum: ["pending", "in_progress", "on_hold", "cancelled", "complete"],
      default: "pending",
    },
    start_date: Date,
    due_date: Date,
    completed_at: Date,
    budget: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "PKR" },
    customer_id: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customer_name: { type: String, required: true },
    customer_phone: { type: String, required: true },
    tags: [String],
    notes: String,
    progress: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true, versionKey: false }
);

projectSchema.index({ customer_id: 1, status: 1 });
projectSchema.index({ status: 1, due_date: 1 });
projectSchema.index({ name: "text", customer_name: "text" });

projectSchema.pre("save", async function () {
  if (this.isNew && !this.project_no) {
    this.project_no = await getNextNumber("project", "PRJ");
  }
});

const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", projectSchema);

export default Project;
