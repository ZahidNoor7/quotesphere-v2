"use client";
import { createContext, useContext, useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;
const DeviceContext = createContext<boolean>(true); // mobile-first default

export function DeviceProvider({ initialMobile, children }: { initialMobile: boolean; children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(initialMobile);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    // Sync with actual viewport in case UA detection was inaccurate (e.g. tablets)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return <DeviceContext.Provider value={isMobile}>{children}</DeviceContext.Provider>;
}

export function useDevice() {
  return useContext(DeviceContext);
}
