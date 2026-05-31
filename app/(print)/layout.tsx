import "./print.css";

// Minimal layout for the headless-Chrome print route. The app's root layout
// (app/layout.tsx) still wraps this (it owns <html>/<body>), so print.css
// neutralizes the root's fixed/dark body. No app chrome, theme, or toaster here.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="print-root">{children}</div>;
}
