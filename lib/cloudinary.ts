import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

interface RawCloudinary {
  enabled?: boolean;
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
}

/** True only when the in-app Cloudinary integration is enabled and fully filled in. */
export function isCloudinaryConfigured(c?: RawCloudinary | null): boolean {
  return !!(c?.enabled && c.cloudName && c.apiKey && c.apiSecret);
}

/**
 * Load the user's in-app Cloudinary credentials from Settings, or null if the
 * integration is off / incomplete. Config lives in Settings (not env) so each
 * workspace owns its own image hosting.
 */
export async function resolveCloudinaryConfig(userId: string): Promise<CloudinaryConfig | null> {
  await connectDB();
  const s = (await Settings.findOne({}).select("integrations.cloudinary").lean()) as
    | { integrations?: { cloudinary?: RawCloudinary } }
    | null;
  const c = s?.integrations?.cloudinary;
  if (!isCloudinaryConfigured(c)) return null;
  return { cloudName: c!.cloudName!, apiKey: c!.apiKey!, apiSecret: c!.apiSecret! };
}

/**
 * Upload a data URI to Cloudinary using per-call credentials. We pass the
 * account on each call (UploadApiOptions allows it) rather than mutating the
 * global `cloudinary.config()` singleton, which would not be concurrency-safe.
 */
export async function uploadToCloudinary(
  cfg: CloudinaryConfig,
  dataUri: string,
  options: UploadApiOptions = {}
): Promise<UploadApiResponse> {
  return cloudinary.uploader.upload(dataUri, {
    ...options,
    cloud_name: cfg.cloudName,
    api_key: cfg.apiKey,
    api_secret: cfg.apiSecret,
  });
}

export const CLOUDINARY_NOT_CONFIGURED =
  "Image hosting isn't set up. Enable Cloudinary in Settings → Integrations to upload images.";
