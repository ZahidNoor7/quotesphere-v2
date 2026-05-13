"use client";
import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { T1, T2, T3, GLASS, GLASS_BORDER } from "@/lib/ds";
import { Camera, Eye, EyeOff, ShieldCheck } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => d.data);

export default function ProfilePage() {
  const { data: user, mutate } = useSWR("/api/profile", fetcher);
  const [form, setForm] = useState({ name: "", phone: "", bio: "" });
  const [avatar, setAvatar] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name ?? "", phone: user.phone ?? "", bio: user.bio ?? "" });
      setAvatar(user.image ?? "");
    }
  }, [user]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_MB = 5;
    if (!file.type.startsWith("image/")) {
      toast.error("Avatar must be an image file (PNG, JPG, WebP…).");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed: ${MAX_MB} MB.`);
      e.target.value = "";
      return;
    }
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "quotesphere/avatars");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const url = data.data.url;
      // Update local state
      setAvatar(url);
      // Auto-save the URL to the database immediately so refresh doesn't lose it
      const saveRes = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: url }),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.error);
      mutate();
      toast.success("Avatar saved.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, image: avatar }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Profile updated.");
      mutate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!newPassword || !currentPassword) { toast.error("Fill in all password fields."); return; }
    if (newPassword !== confirmPassword) { toast.error("New passwords don't match."); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setChangingPwd(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Password changed successfully.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChangingPwd(false);
    }
  }

  const lbl = { fontSize: 11, color: T3, fontWeight: 500, marginBottom: 4, display: "block" } as const;
  const secTitle = { fontSize: 14, fontWeight: 500, color: T1, marginBottom: 14 } as const;
  const col2 = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 } as const;
  const divider = { borderTop: `0.5px solid ${GLASS_BORDER}`, paddingTop: 20, marginBottom: 16 } as const;

  const initials = (form.name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Avatar */}
      <div style={{ ...secTitle }}>Profile photo</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg,var(--accent),var(--accent2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff" }}>
            {avatar
              ? <img src={avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initials}
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
          >
            <Camera size={11} />
          </button>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T1 }}>{form.name || "—"}</div>
          <div style={{ fontSize: 12, color: T3 }}>{user?.email}</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 2, textTransform: "capitalize" }}>Role: {user?.role}</div>
        </div>
        <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
      </div>

      {/* Basic info */}
      <div style={secTitle}>Personal information</div>
      <div style={col2}>
        <div>
          <label style={lbl}>Full name</label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
        </div>
        <div>
          <label style={lbl}>Phone number</label>
          <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+92 300 1234567" />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Bio</label>
        <Textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="A short bio about yourself..." rows={3} style={{ height: 76 }} />
      </div>
      <Button loading={saving} onClick={saveProfile} style={{ marginBottom: 32 }}>Save changes</Button>

      {/* Password */}
      <div style={divider}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <ShieldCheck size={15} color="#818cf8" />
          <div style={{ ...secTitle, marginBottom: 0 }}>Change password</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={lbl}>Current password</label>
            <div style={{ position: "relative" }}>
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                style={{ paddingRight: 36 }}
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T3 }}>
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div style={col2}>
            <div>
              <label style={lbl}>New password</label>
              <div style={{ position: "relative" }}>
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  style={{ paddingRight: 36 }}
                />
                <button type="button" onClick={() => setShowNew(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T3 }}>
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label style={lbl}>Confirm new password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <div style={{ fontSize: 11, color: "#f87171" }}>Passwords don't match.</div>
          )}
          <Button
            loading={changingPwd}
            onClick={changePassword}
            disabled={!currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            variant="secondary"
            style={{ alignSelf: "flex-start" }}
          >
            Change password
          </Button>
        </div>
      </div>
    </div>
  );
}
