import { useDevice } from "@/components/layout/device-provider";

// useDevice() reads from DeviceContext, which is initialized server-side from the
// User-Agent header in app/layout.tsx — no SSR/client mismatch, no flicker.
export function useIsMobile() {
  return useDevice();
}
