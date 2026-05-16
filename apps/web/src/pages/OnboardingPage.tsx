import { useState } from "react";
import { api } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";

const s: Record<string, React.CSSProperties> = {
  page:  { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4ff" },
  card:  { background: "#fff", borderRadius: 12, padding: "40px 36px", width: 420, boxShadow: "0 4px 24px rgba(0,0,0,.08)" },
  logo:  { color: "#0066CC", fontSize: 24, fontWeight: 700, marginBottom: 4 },
  sub:   { color: "#6B7280", fontSize: 13, marginBottom: 28 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, outline: "none", marginBottom: 16 },
  btn:   { width: "100%", padding: "11px", borderRadius: 8, background: "#0066CC", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" },
  err:   { color: "#DC2626", fontSize: 13, marginBottom: 12 },
};

export default function OnboardingPage() {
  const [companyName, setCompanyName] = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const result = await api.onboarding.createTenant(companyName);
      // Edge Function ile app_metadata güncelle
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.functions.invoke("set-tenant-metadata", {
          body: { tenantId: result.tenantId },
        });
        // Oturumu yenile — app_metadata güncellenmiş JWT al
        await supabase.auth.refreshSession();
      }
      window.location.href = "/";
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Hata oluştu");
    }
    setLoading(false);
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>Voltfox</div>
        <div style={s.sub}>Hesabınızı kurmak için şirket adınızı girin</div>
        {error && <div style={s.err}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Şirket Adı</label>
          <input style={s.input} value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="Örn: Çelik A.Ş." required minLength={2} />
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? "Oluşturuluyor..." : "Devam Et"}
          </button>
        </form>
      </div>
    </div>
  );
}
