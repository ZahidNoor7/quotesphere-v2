"use client";
import { useSettings } from "@/hooks/use-settings";

/**
 * True when in-app image storage (Cloudinary) is configured. Image-upload
 * controls across the app gate on this and show a "set up storage" notice when
 * it's false. See Settings → Integrations → Cloudinary.
 */
export function useCloudinaryConfigured(): boolean {
  const { settings } = useSettings();
  return !!settings?.cloudinaryConfigured;
}
