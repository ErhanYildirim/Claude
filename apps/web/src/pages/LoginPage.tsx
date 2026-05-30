import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { Button, Card, Input } from "../components/ui/index.js";

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4ff" },
  logo:   { color: "var(--accent)", fontSize: 24, fontWeight: 700, marginBottom: 4 },
  sub:    { color: "var(--text-muted)", fontSize: 13, marginBottom: 28 },
  err:    { color: "var(--danger)", fontSize: 13, marginBottom: 12 },
  toggle: { textAlign: "center" as const, marginTop: 18, fontSize: 13, color: "var(--text-muted)" },
  link:   { color: "var(--accent)", cursor: "pointer", fontWeight: 600, textDecoration: "none" },
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
      <Card style={{ padding: "40px 36px", width: 380 }}>
        <div style={s.logo}>Voltfox</div>
        <div style={s.sub}>CBAM Actual Emissions Platform</div>
        {error   && <div style={s.err}>{error}</div>}
        {message && <div style={{ ...s.err, color: "var(--success)" }}>{message}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <Input
              label="E-posta"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Input
              label="Şifre"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button variant="primary" size="lg" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "..." : mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
          </Button>
        </form>
        <div style={s.toggle}>
          {mode === "login" ? "Hesabınız yok mu?" : "Zaten hesabınız var mı?"}
          {" "}
          <span style={s.link} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
            {mode === "login" ? "Kayıt Ol" : "Giriş Yap"}
          </span>
        </div>
      </Card>
    </div>
  );
}
