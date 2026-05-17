import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWhatsAppMessage extends Document {
  user_id?: mongoose.Types.ObjectId;
  direction: "in" | "out";
  from: string;
  to: string;
  body: string;
  type: "text" | "template";
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  isRead: boolean;
  errorCode?: string;
  errorDetails?: string;
  customer_id?: mongoose.Types.ObjectId;
  customer_name?: string;
  timestamp: Date;
}

const whatsAppMessageSchema = new Schema<IWhatsAppMessage>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    direction: { type: String, enum: ["in", "out"], required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, enum: ["text", "template"], default: "text" },
    messageId: { type: String, required: true, unique: true },
    status: { type: String, enum: ["sent", "delivered", "read", "failed"], default: "sent" },
    isRead: { type: Boolean, default: false },
    errorCode: String,
    errorDetails: String,
    customer_id: { type: Schema.Types.ObjectId, ref: "Customer" },
    customer_name: String,
    timestamp: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false }
);

whatsAppMessageSchema.index({ from: 1, timestamp: -1 });
whatsAppMessageSchema.index({ to: 1, timestamp: -1 });

const WhatsAppMessage: Model<IWhatsAppMessage> =
  mongoose.models.WhatsAppMessage ||
  mongoose.model<IWhatsAppMessage>("WhatsAppMessage", whatsAppMessageSchema);

export default WhatsAppMessage;
