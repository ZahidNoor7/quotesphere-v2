import mongoose, { Schema, Document, Model } from "mongoose";
import { getNextNumber } from "./Counter";

export interface IProjectMilestone {
  _id: string;
  name: string;
  description?: string;
  due_date?: Date;
  completed_at?: Date;
  invoice_id?: string;
  notes?: string;
}

export interface IProjectNote {
  _id: string;
  content: string;
  createdAt: Date;
}

export interface IProjectAttachment {
  _id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

export interface IProject extends Document {
  project_no: string;
  name: string;
  description?: string;
  status: "pending" | "in_progress" | "on_hold" | "cancelled" | "complete";
  start_date?: Date;
  due_date?: Date;
  expected_end_date?: Date;
  completed_at?: Date;
  budget: number;
  currency: string;
  customer_id: mongoose.Types.ObjectId;
  customer_name: string;
  customer_phone: string;
  tags?: string[];
  notes?: string;
  milestones?: IProjectMilestone[];
  project_notes?: IProjectNote[];
  attachments?: IProjectAttachment[];
  progress?: number;
  createdAt: Date;
  updatedAt: Date;
}

const projectMilestoneSchema = new Schema(
  {
    name:         { type: String, required: true, maxlength: 200 },
    description:  { type: String, maxlength: 1000 },
    due_date:     Date,
    completed_at: Date,
    invoice_id:   { type: Schema.Types.ObjectId, ref: "Invoice" },
    notes:        { type: String, maxlength: 1000 },
  },
  { timestamps: true, _id: true }
);

const projectNoteSchema = new Schema(
  { content: { type: String, required: true } },
  { timestamps: true, _id: true }
);

const projectAttachmentSchema = new Schema(
  {
    url: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

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
    expected_end_date: Date,
    completed_at: Date,
    budget: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "PKR" },
    customer_id: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    customer_name: { type: String, required: true },
    customer_phone: { type: String, required: true },
    tags: [String],
    notes: String,
    milestones: [projectMilestoneSchema],
    project_notes: [projectNoteSchema],
    attachments: [projectAttachmentSchema],
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
