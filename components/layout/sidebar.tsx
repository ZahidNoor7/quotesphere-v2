"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { getInitials } from "@/lib/utils";

const NAV = [
  {
    section: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/assistant", label: "Assistant", icon: "assistant" },
    ],
  },
  {
    section: "Sales",
    items: [
      { href: "/customers", label: "Clients", icon: "clients" },
      { href: "/projects", label: "Projects", icon: "projects" },
      { href: "/invoices", label: "Invoices", icon: "invoices" },
      { href: "/quotations", label: "Quotations", icon: "quotations" },
      { href: "/expenses", label: "Expenses", icon: "expenses" },
      { href: "/messaging", label: "Messaging", icon: "messaging" },
    ],
  },
  {
    section: "Catalog",
    items: [
      { href: "/services", label: "Services", icon: "services" },
      { href: "/products", label: "Products", icon: "products" },
    ],
  },
  {
    section: "Admin",
    items: [
      { href: "/reports", label: "Reports", icon: "reports" },
      { href: "/settings", label: "Settings", icon: "settings" },
      { href: "/docs", label: "Help & Guides", icon: "help" },
    ],
  },
];

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
  clients: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2-5 5-5s5 2 5 5"/><circle cx="12.5" cy="5" r="2"/><path d="M11 14c0-1.5.6-3 1.5-3.5"/></svg>,
  projects: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 7h6M5 10h4"/></svg>,
  invoices: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M9 2v3h3"/><path d="M8 7.5v-.5M8 11v-.5M6.5 9.5c0-.6.7-.9 1.5-.9s1.5.3 1.5.9-.7.9-1.5.9-1.5.3-1.5.9.7.9 1.5.9 1.5-.3 1.5-.9"/></svg>,
  quotations: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="4" width="10" height="10" rx="1.5"/><path d="M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1"/><path d="M5.5 8h5M5.5 10.5h3"/></svg>,
  expenses: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="6"/><path d="M8 5v6M6 7h3.5a1 1 0 010 2H6"/></svg>,
  services: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><path d="M9 12h6M12 9v6"/></svg>,
  products: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 5l6-3 6 3v6l-6 3-6-3V5z"/><path d="M8 2v12M2 5l6 3 6-3"/></svg>,
  reports: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="1" width="14" height="14" rx="1.5"/><path d="M4 11V8M7 11V5M10 11V7M13 11V9"/></svg>,
  settings: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M11.2 4.8l1.3-1.3M3.5 12.5l1.3-1.3"/></svg>,
  messaging: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H6l-3 2V3z"/><path d="M5 6h6M5 8.5h4"/></svg>,
  assistant: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"><path d="M8 2l1.5 4L14 7.5 9.5 9 8 13.5 6.5 9 2 7.5 6.5 6z"/><path d="M12.5 2.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/></svg>,
  help: <svg className="w-[15px] h-[15px]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"><path d="M8 3.5C6.8 2.7 5.4 2.5 4 2.5H2.2v9.5H4c1.4 0 2.8.2 4 1 1.2-.8 2.6-1 4-1h1.8v-9.5H12c-1.4 0-2.8.2-4 1z"/><path d="M8 3.5v9.5"/></svg>,
};

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const initials = getInitials(session?.user?.name || "U");
  const [isHovered, setIsHovered] = useState(false);
  const [ready, setReady] = useState(false);
  const leaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enable width transition only after first render so the localStorage correction
  // (in AppShell's useLayoutEffect) doesn't animate on page load.
  useEffect(() => { setReady(true); }, []);

  const handleMouseEnter = () => {
    if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
    setIsHovered(true);
  };
  const handleMouseLeave = () => {
    leaveTimeout.current = setTimeout(() => setIsHovered(false), 80);
  };

  return (
    <>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: collapsed ? 72 : 234,
          background: "var(--glass-surface-bg)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRight: "0.5px solid var(--glass-border)",
          transition: ready ? "width 0.28s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}
        className="flex flex-col h-full shrink-0 z-30 relative overflow-hidden"
      >
        {/* Logo */}
        <div style={{
          padding: collapsed ? "14px 8px 12px" : "18px 16px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
          minHeight: 58,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: collapsed ? "unset" : 1 }}>
            <div style={{
              width: collapsed ? 30 : 34,
              height: collapsed ? 30 : 34,
              borderRadius: 10,
              background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: collapsed ? 13 : 15, fontWeight: 600, color: "#fff", flexShrink: 0,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.15) inset, 0 4px 12px var(--accent-glow)",
              transition: "all 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
            }}>Q</div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)", letterSpacing: "-0.01em" }}>QuoteSphere</div>
                <div style={{ fontSize: 10, color: "var(--t3)" }}>Pro</div>
              </div>
            )}
          </div>
          {/* Toggle only visible when expanded */}
          {!collapsed && (
            <button
              onClick={onToggle}
              style={{
                width: 20, height: 20, borderRadius: 6,
                background: "var(--glass)", border: "0.5px solid var(--glass-border)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--t3)", flexShrink: 0,
                transition: "background 0.15s, color 0.15s, transform 0.15s",
              }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: "var(--glass-hover)", color: "var(--t1)", transform: "scale(1.1)" })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: "var(--glass)", color: "var(--t3)", transform: "scale(1)" })}
              title="Collapse sidebar"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 2L4 6l4 4"/>
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: collapsed ? "4px 8px" : "8px 10px", overflowY: "auto" }} className="scrollbar-hide">
          {NAV.map(({ section, items }, sectionIndex) => (
            <div key={section}>
              {!collapsed ? (
                <div style={{
                  fontSize: 11, fontWeight: 500, letterSpacing: "0.09em",
                  textTransform: "uppercase", color: "var(--t3)",
                  padding: "12px 8px 5px",
                }}>
                  {section}
                </div>
              ) : sectionIndex > 0 ? (
                <div style={{
                  height: "0.5px",
                  background: "var(--glass-border)",
                  margin: "8px 4px",
                  opacity: 0.7,
                }} />
              ) : null}

              {items.map(({ href, label, icon }) => {
                const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: collapsed ? "center" : "flex-start",
                      gap: collapsed ? 0 : 9,
                      padding: collapsed ? "9px 0" : "8px 10px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 13.5,
                      marginBottom: collapsed ? 2 : 1,
                      transition: "background 0.15s, color 0.15s",
                      textDecoration: "none",
                      ...(active ? {
                        background: "linear-gradient(135deg,color-mix(in srgb,var(--accent) 25%,transparent),color-mix(in srgb,var(--accent2) 12%,transparent))",
                        color: "var(--accent2)", fontWeight: 500,
                        border: "0.5px solid color-mix(in srgb,var(--accent) 25%,transparent)",
                        boxShadow: "0 1px 8px var(--accent-glow)",
                      } : {
                        color: "var(--t2)",
                        border: "0.5px solid transparent",
                      }),
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        Object.assign((e.currentTarget as HTMLElement).style, {
                          background: "var(--glass-hover)",
                          color: "var(--t1)",
                        });
                      }
                      const iconEl = (e.currentTarget as HTMLElement).querySelector(".nav-icon") as HTMLElement;
                      if (iconEl) iconEl.style.transform = "scale(1.2)";
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        Object.assign((e.currentTarget as HTMLElement).style, {
                          background: "transparent",
                          color: "var(--t2)",
                        });
                      }
                      const iconEl = (e.currentTarget as HTMLElement).querySelector(".nav-icon") as HTMLElement;
                      if (iconEl) iconEl.style.transform = "scale(1)";
                    }}
                  >
                    <span
                      className="nav-icon"
                      style={{
                        width: 17, height: 17, flexShrink: 0,
                        opacity: active ? 1 : 0.7,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s",
                      }}
                    >
                      {ICONS[icon]}
                    </span>
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: collapsed ? "10px 8px" : "10px", borderTop: "0.5px solid var(--glass-border)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: collapsed ? 0 : 9,
              padding: collapsed ? "7px 0" : "8px 10px",
              borderRadius: 10,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            className="hover:bg-white/6"
            title={collapsed ? (session?.user?.name || "User") : undefined}
          >
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "linear-gradient(135deg,var(--accent),var(--accent2))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, color: "#fff", flexShrink: 0,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.15)",
            }}>{initials}</div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }} className="truncate">{session?.user?.name || "User"}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>Admin</div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                  style={{
                    width: 24, height: 24, borderRadius: 6, border: "none",
                    background: "var(--glass)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--t3)", flexShrink: 0,
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: "var(--glass-hover)", color: "var(--t1)" })}
                  onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: "var(--glass)", color: "var(--t3)" })}
                  title="Sign out"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M7 8h6"/></svg>
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Right-border expand button — only when collapsed, appears on hover */}
      {collapsed && (
        <button
          onClick={onToggle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          title="Expand sidebar"
          style={{
            position: "absolute",
            right: -12,
            top: "50%",
            transform: isHovered
              ? "translateY(-50%) translateX(0) scale(1)"
              : "translateY(-50%) translateX(-4px) scale(0.85)",
            width: 24, height: 24,
            borderRadius: "50%",
            background: "var(--glass-surface-bg)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "0.5px solid var(--glass-border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--t2)",
            zIndex: 40,
            opacity: isHovered ? 1 : 0,
            pointerEvents: isHovered ? "auto" : "none",
            transition: "opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s, color 0.15s",
          }}
          onMouseOver={e => Object.assign((e.currentTarget as HTMLElement).style, { background: "var(--glass-hover)", color: "var(--t1)" })}
          onMouseOut={e => Object.assign((e.currentTarget as HTMLElement).style, { background: "var(--glass-surface-bg)", color: "var(--t2)" })}
        >
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 2l4 4-4 4"/>
          </svg>
        </button>
      )}
    </>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <>
      {/* Top bar */}
      <header style={{
        background: "var(--glass-surface-bg)",
        backdropFilter: "blur(30px) saturate(180%)",
        WebkitBackdropFilter: "blur(30px) saturate(180%)",
        borderBottom: "0.5px solid var(--glass-border)",
      }} className="md:hidden flex items-center h-14 px-4 gap-3 z-20">
        <button onClick={() => setOpen(true)} style={{ background: "var(--glass)", border: "0.5px solid var(--glass-border)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: "var(--t2)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M2 8h12M2 12h12"/></svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>Q</div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)" }}>QuoteSphere</span>
        </div>
      </header>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 flex flex-col animate-slide-up"
            style={{ background: "var(--modal-bg)", backdropFilter: "blur(40px)", border: "0.5px solid var(--glass-border)" }}
          >
            <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid var(--glass-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>Q</div>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--t1)" }}>QuoteSphere</span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3l10 10M13 3L3 13"/></svg>
              </button>
            </div>
            <nav style={{ flex: 1, padding: "10px", overflowY: "auto" }}>
              {NAV.map(({ section, items }) => (
                <div key={section}>
                  <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--t3)", padding: "10px 8px 4px" }}>{section}</div>
                  {items.map(({ href, label, icon }) => {
                    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                    return (
                      <Link key={href} href={href} onClick={() => setOpen(false)}
                        style={{
                          display: "flex", alignItems: "center", gap: 9,
                          padding: "9px 10px", borderRadius: 10, marginBottom: 2,
                          textDecoration: "none", fontSize: 13,
                          ...(active ? {
                            background: "linear-gradient(135deg,color-mix(in srgb,var(--accent) 25%,transparent),color-mix(in srgb,var(--accent2) 12%,transparent))",
                            color: "var(--accent2)", fontWeight: 500,
                            border: "0.5px solid color-mix(in srgb,var(--accent) 25%,transparent)",
                          } : { color: "var(--t2)" }),
                        }}
                      >
                        <span style={{ width: 15, height: 15, flexShrink: 0, opacity: active ? 1 : 0.7 }}>{ICONS[icon]}</span>
                        {label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div style={{ padding: 12, borderTop: "0.5px solid var(--glass-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff" }}>
                  {getInitials(session?.user?.name || "U")}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#eef0ff" }} className="truncate">{session?.user?.name || "User"}</div>
                  <div style={{ fontSize: 10, color: "rgba(160,170,255,0.42)" }}>{session?.user?.email || ""}</div>
                </div>
                <button onClick={() => signOut({ callbackUrl: "/auth/login" })} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(160,170,255,0.42)", padding: 4 }}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3M10 11l3-3-3-3M7 8h6"/></svg>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
