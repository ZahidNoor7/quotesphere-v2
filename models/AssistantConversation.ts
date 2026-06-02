import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAssistantToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface IAssistantMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: IAssistantToolCall[];
  toolCallId?: string;
  toolName?: string;
  documentLink?: string;
  documentLabel?: string;
  createdAt: Date;
}

export interface IPendingActionPreview {
  label: string;
  value: string;
}

export interface ISiblingToolResult {
  toolCallId: string;
  toolName: string;
  content: string;
}

export interface IPendingAction {
  id: string;
  toolCallId: string;
  tool: string;
  method: string;
  endpoint: string;
  payload: unknown;
  title: string;
  summary: string;
  preview: IPendingActionPreview[];
  docType?: string;
  siblingResults: ISiblingToolResult[];
}

export interface IAssistantConversation extends Document {
  user_id: mongoose.Types.ObjectId;
  title: string;
  messages: IAssistantMessage[];
  pendingAction?: IPendingAction | null;
  createdAt: Date;
  updatedAt: Date;
}

const toolCallSchema = new Schema<IAssistantToolCall>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    input: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const messageSchema = new Schema<IAssistantMessage>(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant", "tool"], required: true },
    content: { type: String, default: "" },
    toolCalls: { type: [toolCallSchema], default: undefined },
    toolCallId: String,
    toolName: String,
    documentLink: String,
    documentLabel: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const previewSchema = new Schema<IPendingActionPreview>(
  { label: String, value: String },
  { _id: false }
);

const siblingResultSchema = new Schema<ISiblingToolResult>(
  { toolCallId: String, toolName: String, content: String },
  { _id: false }
);

const pendingActionSchema = new Schema<IPendingAction>(
  {
    id: { type: String, required: true },
    toolCallId: { type: String, required: true },
    tool: { type: String, required: true },
    method: { type: String, required: true },
    endpoint: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    title: String,
    summary: String,
    preview: { type: [previewSchema], default: [] },
    docType: String,
    siblingResults: { type: [siblingResultSchema], default: [] },
  },
  { _id: false }
);

const conversationSchema = new Schema<IAssistantConversation>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New chat" },
    messages: { type: [messageSchema], default: [] },
    pendingAction: { type: pendingActionSchema, default: null },
  },
  { timestamps: true, versionKey: false }
);

conversationSchema.index({ user_id: 1, updatedAt: -1 });

const AssistantConversation: Model<IAssistantConversation> =
  mongoose.models.AssistantConversation ||
  mongoose.model<IAssistantConversation>("AssistantConversation", conversationSchema);

export default AssistantConversation;
