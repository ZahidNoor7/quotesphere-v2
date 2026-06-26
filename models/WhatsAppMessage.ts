import mongoose, { Schema, Document, Model } from "mongoose";
import { tenantScope } from "@/lib/tenant-plugin";

export type WhatsAppMessageType =
  | "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contacts" | "template";

export interface IWhatsAppMessage extends Document {
  org_id?: mongoose.Types.ObjectId;
  user_id?: mongoose.Types.ObjectId;
  direction: "in" | "out";
  from: string;
  to: string;
  body: string;
  /** Legacy coarse type; kept for back-compat. Prefer `messageType`. */
  type: "text" | "template";
  /** Fine-grained WhatsApp message type, drives rendering. */
  messageType: WhatsAppMessageType;
  /** Publicly fetchable media URL (outbound: Cloudinary). Inbound media is served via the proxy by mediaId. */
  mediaUrl?: string;
  /** 360dialog media id for inbound media (fetched through the authed proxy). */
  mediaId?: string;
  mediaMime?: string;
  mediaFilename?: string;
  /** Caption that accompanies a media message. */
  caption?: string;
  location?: { lat: number; lng: number; name?: string; address?: string };
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
    body: { type: String, default: "" },
    type: { type: String, enum: ["text", "template"], default: "text" },
    messageType: {
      type: String,
      enum: ["text", "image", "video", "audio", "document", "sticker", "location", "contacts", "template"],
      default: "text",
    },
    mediaUrl: String,
    mediaId: String,
    mediaMime: String,
    mediaFilename: String,
    caption: String,
    location: {
      type: { lat: Number, lng: Number, name: String, address: String },
      required: false,
      _id: false,
    },
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

whatsAppMessageSchema.index({ org_id: 1, from: 1, timestamp: -1 });
whatsAppMessageSchema.index({ org_id: 1, to: 1, timestamp: -1 });
whatsAppMessageSchema.index({ org_id: 1, mediaId: 1 });

whatsAppMessageSchema.plugin(tenantScope);

const WhatsAppMessage: Model<IWhatsAppMessage> =
  mongoose.models.WhatsAppMessage ||
  mongoose.model<IWhatsAppMessage>("WhatsAppMessage", whatsAppMessageSchema);

export default WhatsAppMessage;
