import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/auth/login");
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get("qs-sidebar-collapsed")?.value === "true";
  return <AppShell initialCollapsed={initialCollapsed}>{children}</AppShell>;
}
