import { useState } from "react";
import { supabase } from "../lib/supabase.js";

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4ff" },
  card:   { background: "#fff", borderRadius: 12, padding: "40px 36px", width: 380, boxShadow: "0 4px 24px rgba(0,0,0,.08)" },
  logo:   { color: "#0066CC", fontSize: 24, fontWeight: 700, marginBottom: 4 },
  sub:    { color: "#6B7280", fontSize: 13, marginBottom: 28 },
  label:  { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 },
  input:  { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, outline: "none", marginBottom: 16 },
  btn:    { width: "100%", padding: "11px", borderRadius: 8, background: "#0066CC", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer" },
  err:    { color: "#DC2626", fontSize: 13, marginBottom: 12 },
  toggle: { textAlign: "center" as const, marginTop: 18, fontSize: 13, color: "#6B7280" },
  link:   { color: "#0066CC", cursor: "pointer", fontWeight: 600, textDecoration: "none" },
};

export default function LoginPage() {
  const [mode, setMode]       = useState<"login" | "signup">("login");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMessage(""); setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("Kayıt başarılı! E-posta adresinizi doğrulayın.");
    }
    setLoading(false);
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>Voltfox</div>
        <div style={s.sub}>CBAM Actual Emissions Platform</div>
        {error   && <div style={s.err}>{error}</div>}
        {message && <div style={{ ...s.err, color: "#059669" }}>{message}</div>}
        <form onSubmit={handleSubmit}>
          <label style={s.label}>E-posta</label>
          <input style={s.input} type="email" value={email}
            onChange={e => setEmail(e.target.value)} required />
          <label style={s.label}>Şifre</label>
          <input style={s.input} type="password" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6} />
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
          </button>
        </form>
        <div style={s.toggle}>
          {mode === "login" ? "Hesabınız yok mu?" : "Zaten hesabınız var mı?"}
          {" "}
          <span style={s.link} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
            {mode === "login" ? "Kayıt Ol" : "Giriş Yap"}
          </span>
        </div>
      </div>
    </div>
  );
}
