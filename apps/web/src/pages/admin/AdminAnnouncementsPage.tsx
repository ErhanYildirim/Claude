import { useState } from "react";
import { api } from "../../lib/api.js";

export default function AdminAnnouncementsPage() {
  const [title,    setTitle]    = useState("");
  const [body,     setBody]     = useState("");
  const [tenantId, setTenantId] = useState("");
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState<{ created: number; message: string } | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  async function send() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const r = await api.admin.announcements.send({
        title: title.trim(),
        body:  body.trim(),
        ...(tenantId.trim() ? { tenantId: tenantId.trim() } : {}),
      });
      setResult(r);
      setTitle(""); setBody(""); setTenantId("");
    } catch (e: unknown) {
      setError((e as Error).message ?? "Gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 680 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Duyuru Gönder</h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28 }}>
        Tenant ID boş bırakılırsa tüm kullanıcılara bildirim gider.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
            Başlık *
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Duyuru başlığı"
            maxLength={200}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
            Mesaj *
          </label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Duyuru metni"
            rows={5}
            maxLength={2000}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{body.length}/2000</div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
            Tenant ID (isteğe bağlı)
          </label>
          <input
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            placeholder="UUID — boş bırakırsan tüm tenant'lara gider"
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box", fontFamily: "monospace" }}
          />
        </div>

        {result && (
          <div style={{ padding: "12px 16px", borderRadius: 6, background: "#d1fae5", color: "#065f46", fontSize: 14 }}>
            ✓ {result.message}
          </div>
        )}
        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 6, background: "#fee2e2", color: "#b91c1c", fontSize: 14 }}>
            {error}
          </div>
        )}

        <button
          onClick={send}
          disabled={sending || !title.trim() || !body.trim()}
          style={{
            padding: "10px 24px",
            borderRadius: 7,
            border: "none",
            background: sending || !title.trim() || !body.trim() ? "#d1d5db" : "#1d4ed8",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: sending || !title.trim() || !body.trim() ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {sending ? "Gönderiliyor…" : "Duyuruyu Gönder"}
        </button>
      </div>
    </div>
  );
}
