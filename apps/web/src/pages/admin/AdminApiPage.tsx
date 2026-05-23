import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api.js";
import type {
  AdminApiStats, AdminApiKey, AdminApiKeyList,
  AdminApiRequest, AdminApiRequestList,
} from "../../lib/api.js";

// ── helpers ────────────────────────────────────────────────────────────────────
function fmtNum(n: number): string {
  return n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M"
    : n >= 1_000 ? (n / 1_000).toFixed(1) + "K"
    : String(n);
}

function statusColor(code: number): string {
  if (code < 300) return "#22c55e";
  if (code < 400) return "#f59e0b";
  return "#ef4444";
}

function methodColor(m: string): string {
  return m === "GET" ? "#60a5fa" : m === "POST" ? "#a78bfa" : m === "DELETE" ? "#f87171" : "#94a3b8";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s önce`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}d önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}s önce`;
  return `${Math.floor(h / 24)}g önce`;
}

// ── mini bar chart (no dependency) ────────────────────────────────────────────
function HourlyBarChart({ data }: { data: { hour: string; count: number; errors: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const BAR_W = 18;
  const HEIGHT = 80;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: HEIGHT, overflow: "hidden" }}>
      {data.map((d, i) => {
        const h = Math.max(2, Math.round((d.count / maxVal) * HEIGHT));
        const eh = d.errors > 0 ? Math.max(1, Math.round((d.errors / maxVal) * HEIGHT)) : 0;
        const label = new Date(d.hour).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        return (
          <div
            key={i}
            title={`${label}: ${d.count} istek, ${d.errors} hata`}
            style={{ width: BAR_W, height: h, display: "flex", flexDirection: "column-reverse", cursor: "default" }}
          >
            <div style={{ width: "100%", height: h, background: "#334155", borderRadius: "2px 2px 0 0", position: "relative", overflow: "hidden" }}>
              {eh > 0 && (
                <div style={{ position: "absolute", bottom: 0, width: "100%", height: eh, background: "#ef4444" }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "18px 22px",
    }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? "var(--text)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── tabs ───────────────────────────────────────────────────────────────────────
type Tab = "overview" | "keys" | "requests" | "limits";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "Genel Bakış" },
  { id: "keys",      label: "API Anahtarları" },
  { id: "requests",  label: "İstek Logu" },
  { id: "limits",    label: "Hız Limitleri" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Overview
// ═══════════════════════════════════════════════════════════════════════════════
function OverviewTab() {
  const [stats, setStats] = useState<AdminApiStats | null>(null);
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.apiMonitoring.stats()
      .then(setStats)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "var(--text-muted)", padding: 40 }}>Yükleniyor…</div>;
  if (err)     return <div style={{ color: "#ef4444", padding: 40 }}>{err}</div>;
  if (!stats)  return null;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
        <KpiCard label="Son 24s İstek"  value={fmtNum(stats.requests.total24h)} />
        <KpiCard label="Hata Sayısı"    value={fmtNum(stats.requests.errors24h)} color="#ef4444" />
        <KpiCard label="Hata Oranı"     value={stats.requests.errorRate + "%"} color={Number(stats.requests.errorRate) > 10 ? "#ef4444" : "#22c55e"} />
        <KpiCard label="İstek/dk (1s)"  value={String(stats.requests.perMinute1h)} sub="son 1 saat ort." />
        <KpiCard label="Aktif Key"      value={fmtNum(stats.keys.active)} sub={`Toplam ${stats.keys.total}`} />
      </div>

      {/* Hourly bar chart */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "20px 22px", marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
          Son 24 Saat — Saatlik İstek Dağılımı
        </div>
        {stats.hourlyBreakdown.length > 0
          ? <HourlyBarChart data={stats.hourlyBreakdown} />
          : <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Henüz veri yok</div>
        }
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, background: "#334155", borderRadius: 2, display: "inline-block" }} />
            İstek
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, background: "#ef4444", borderRadius: 2, display: "inline-block" }} />
            Hata
          </span>
        </div>
      </div>

      {/* Top tenants */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "20px 22px",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>
          En Aktif Tenant'lar (Son 24s)
        </div>
        {stats.topTenants.length === 0
          ? <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Veri yok</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stats.topTenants.map((t, i) => {
                const pct = Math.round((t.requests / (stats.requests.total24h || 1)) * 100);
                return (
                  <div key={t.tenantId}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: "var(--text)" }}>
                        <span style={{ color: "var(--text-muted)", marginRight: 6 }}>#{i + 1}</span>
                        {t.tenantName}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>{fmtNum(t.requests)} ({pct}%)</span>
                    </div>
                    <div style={{ height: 4, background: "var(--border)", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — API Keys
// ═══════════════════════════════════════════════════════════════════════════════
function KeysTab() {
  const [data, setData]     = useState<AdminApiKeyList | null>(null);
  const [search, setSearch] = useState("");
  const [err, setErr]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState<string>("");
  const [page, setPage]         = useState(0);
  const PAGE_SIZE = 50;

  const load = useCallback(() => {
    setLoading(true);
    api.admin.apiMonitoring.keys({ search: search || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  async function revoke(key: AdminApiKey) {
    if (!confirm(`"${key.name}" anahtarını iptal et? Bu işlem geri alınamaz.`)) return;
    setBusy(key.id);
    try {
      await api.admin.apiMonitoring.revokeKey(key.id);
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally { setBusy(""); }
  }

  const cell: React.CSSProperties = {
    padding: "10px 12px", fontSize: 12, color: "var(--text)",
    borderBottom: "1px solid var(--border-light)",
    verticalAlign: "middle",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="İsim veya prefix ara…"
          style={{
            flex: 1, padding: "8px 12px", borderRadius: 7,
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text)", fontSize: 13, outline: "none",
          }}
        />
        <button onClick={load} style={{
          padding: "8px 14px", borderRadius: 7, border: "1px solid var(--border)",
          background: "var(--bg-card)", color: "var(--text)", cursor: "pointer", fontSize: 13,
        }}>Yenile</button>
      </div>

      {err && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 13 }}>{err}</div>}
      {loading && <div style={{ color: "var(--text-muted)", padding: 20, fontSize: 13 }}>Yükleniyor…</div>}

      {!loading && data && (
        <>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
                  {["İsim / Prefix", "Tenant", "Plan", "Scope'lar", "Son 24s", "Hatalar", "Durum", ""].map(h => (
                    <th key={h} style={{ ...cell, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.keys.map(k => (
                  <tr key={k.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={cell}>
                      <div style={{ fontWeight: 600 }}>{k.name}</div>
                      <div style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>{k.prefix}…</div>
                    </td>
                    <td style={cell}>
                      <div>{k.tenant.name}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{k.tenant.slug}</div>
                    </td>
                    <td style={cell}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                        background: k.tenant.plan === "enterprise" ? "#1e3a5f" : k.tenant.plan === "pro" ? "#14532d" : "#1e293b",
                        color: k.tenant.plan === "enterprise" ? "#93c5fd" : k.tenant.plan === "pro" ? "#86efac" : "#94a3b8",
                      }}>
                        {k.tenant.plan.toUpperCase()}
                      </span>
                    </td>
                    <td style={cell}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {k.scopes.map(s => (
                          <span key={s} style={{
                            fontSize: 10, padding: "1px 5px", borderRadius: 3,
                            background: "var(--accent-bg)", color: "var(--accent)",
                            fontFamily: "monospace",
                          }}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmtNum(k.requests24h)}</td>
                    <td style={{ ...cell, textAlign: "right", color: k.errors24h > 0 ? "#ef4444" : "var(--text-muted)" }}>
                      {k.errors24h > 0 ? fmtNum(k.errors24h) : "—"}
                    </td>
                    <td style={cell}>
                      {k.revokedAt
                        ? <span style={{ color: "#ef4444", fontSize: 11 }}>İptal</span>
                        : k.expiresAt && new Date(k.expiresAt) < new Date()
                          ? <span style={{ color: "#f59e0b", fontSize: 11 }}>Süresi Doldu</span>
                          : <span style={{ color: "#22c55e", fontSize: 11 }}>Aktif</span>
                      }
                    </td>
                    <td style={cell}>
                      {!k.revokedAt && (
                        <button
                          onClick={() => revoke(k)}
                          disabled={busy === k.id}
                          style={{
                            padding: "4px 10px", fontSize: 11, borderRadius: 5, cursor: "pointer",
                            background: "transparent", border: "1px solid #ef4444", color: "#ef4444",
                          }}
                        >
                          {busy === k.id ? "…" : "İptal Et"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12, color: "var(--text-muted)" }}>
            <span>{data.total} anahtar</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>
                ← Önceki
              </button>
              <span style={{ padding: "4px 8px" }}>{page + 1} / {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= data.total}
                style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", cursor: (page + 1) * PAGE_SIZE >= data.total ? "not-allowed" : "pointer", opacity: (page + 1) * PAGE_SIZE >= data.total ? 0.4 : 1 }}>
                Sonraki →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Request Log
// ═══════════════════════════════════════════════════════════════════════════════
function RequestsTab() {
  const [data, setData]       = useState<AdminApiRequestList | null>(null);
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(0);
  const [selected, setSelected] = useState<AdminApiRequest | null>(null);
  const [filters, setFilters] = useState({
    endpoint: "", method: "", status: "", from: "", to: "",
  });
  const PAGE_SIZE = 50;

  const load = useCallback(() => {
    setLoading(true);
    api.admin.apiMonitoring.requests({
      endpoint: filters.endpoint || undefined,
      method:   filters.method   || undefined,
      status:   filters.status   || undefined,
      from:     filters.from     || undefined,
      to:       filters.to       || undefined,
      limit: PAGE_SIZE, offset: page * PAGE_SIZE,
    }).then(setData).catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const cell: React.CSSProperties = { padding: "9px 12px", fontSize: 12, color: "var(--text)", borderBottom: "1px solid var(--border-light)", verticalAlign: "middle" };

  function upd(k: keyof typeof filters, v: string) {
    setFilters(f => ({ ...f, [k]: v }));
    setPage(0);
  }

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Filters */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <input value={filters.endpoint} onChange={e => upd("endpoint", e.target.value)} placeholder="Endpoint filtrele…"
            style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 12, outline: "none" }} />
          <select value={filters.method} onChange={e => upd("method", e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 12 }}>
            <option value="">Tüm Method</option>
            {["GET", "POST", "PATCH", "DELETE"].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filters.status} onChange={e => upd("status", e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 12 }}>
            <option value="">Tüm Durum</option>
            <option value="success">Başarılı</option>
            <option value="error">Hata</option>
          </select>
          <input type="datetime-local" value={filters.from} onChange={e => upd("from", e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 12 }} />
          <input type="datetime-local" value={filters.to} onChange={e => upd("to", e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 12 }} />
        </div>

        {err && <div style={{ color: "#ef4444", marginBottom: 10, fontSize: 13 }}>{err}</div>}
        {loading && <div style={{ color: "var(--text-muted)", padding: 16, fontSize: 13 }}>Yükleniyor…</div>}

        {!loading && data && (
          <>
            <div style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
                    {["Zaman", "Method", "Endpoint", "Durum", "Süre", "Tenant / Key", ""].map(h => (
                      <th key={h} style={{ ...cell, fontWeight: 600, color: "var(--text-muted)", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map(r => (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      style={{ cursor: "pointer", background: selected?.id === r.id ? "var(--accent-bg)" : "transparent" }}
                    >
                      <td style={cell}><span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{timeAgo(r.createdAt)}</span></td>
                      <td style={cell}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "transparent", color: methodColor(r.method), border: `1px solid ${methodColor(r.method)}` }}>
                          {r.method}
                        </span>
                      </td>
                      <td style={{ ...cell, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                        {r.endpoint}
                      </td>
                      <td style={cell}>
                        <span style={{ color: statusColor(r.statusCode), fontWeight: 600 }}>{r.statusCode}</span>
                      </td>
                      <td style={cell}>{r.durationMs}ms</td>
                      <td style={cell}>
                        <div style={{ fontSize: 11 }}>{r.apiKey?.tenant?.name ?? "—"}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 10, fontFamily: "monospace" }}>{r.apiKey?.prefix}…</div>
                      </td>
                      <td style={cell}>
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(r); }}
                          style={{ padding: "3px 8px", fontSize: 11, borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", cursor: "pointer" }}
                        >Detay</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12, color: "var(--text-muted)" }}>
              <span>{data.total} istek</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>← Önceki</button>
                <span style={{ padding: "4px 8px" }}>{page + 1} / {Math.max(1, Math.ceil(data.total / PAGE_SIZE))}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= data.total}
                  style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", cursor: (page + 1) * PAGE_SIZE >= data.total ? "not-allowed" : "pointer", opacity: (page + 1) * PAGE_SIZE >= data.total ? 0.4 : 1 }}>Sonraki →</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{
          width: 320, flexShrink: 0,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 18, fontSize: 12,
          alignSelf: "flex-start", position: "sticky", top: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>İstek Detayı</span>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          {[
            ["ID",        selected.id],
            ["Zaman",     new Date(selected.createdAt).toLocaleString("tr-TR")],
            ["Method",    selected.method],
            ["Endpoint",  selected.endpoint],
            ["Status",    String(selected.statusCode)],
            ["Süre",      selected.durationMs + " ms"],
            ["Tenant",    selected.apiKey?.tenant?.name ?? "—"],
            ["Key Prefix",selected.apiKey?.prefix ? selected.apiKey.prefix + "…" : "—"],
            ["IP",        selected.ipAddress ?? "—"],
            ["User Agent",selected.userAgent ?? "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ marginBottom: 8 }}>
              <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>{k}</div>
              <div style={{ wordBreak: "break-all", color: "var(--text)", fontFamily: k === "ID" || k === "Endpoint" || k === "Key Prefix" ? "monospace" : undefined }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — Rate Limits
// ═══════════════════════════════════════════════════════════════════════════════
function LimitsTab() {
  const [data, setData]       = useState<AdminApiKeyList | null>(null);
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [busy, setBusy]       = useState<string>("");

  const load = useCallback(() => {
    setLoading(true);
    api.admin.apiMonitoring.keys({ limit: 200 })
      .then(d => { setData(d); setEditing({}); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(key: AdminApiKey) {
    const raw = editing[key.id];
    const val = raw === "" ? null : parseInt(raw, 10);
    if (val !== null && (isNaN(val) || val < 1 || val > 10000)) {
      alert("1 ile 10000 arasında bir değer girin (boş = varsayılan 100)");
      return;
    }
    setBusy(key.id);
    try {
      await api.admin.apiMonitoring.setRateLimit(key.id, val);
      load();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setBusy(""); }
  }

  const cell: React.CSSProperties = { padding: "10px 12px", fontSize: 12, color: "var(--text)", borderBottom: "1px solid var(--border-light)", verticalAlign: "middle" };

  return (
    <div>
      <div style={{ background: "var(--accent-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--text-muted)" }}>
        Boş bırakılan limit = varsayılan 100 istek/dakika. Değişiklikler anında uygulanır.
      </div>

      {err && <div style={{ color: "#ef4444", marginBottom: 10, fontSize: 13 }}>{err}</div>}
      {loading && <div style={{ color: "var(--text-muted)", padding: 20, fontSize: 13 }}>Yükleniyor…</div>}

      {!loading && data && (
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
                {["Anahtar", "Tenant", "Anlık Kullanım", "Mevcut Limit", "Yeni Limit", ""].map(h => (
                  <th key={h} style={{ ...cell, fontWeight: 600, color: "var(--text-muted)", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.keys.filter(k => !k.revokedAt).map(k => {
                const isEditing = editing[k.id] !== undefined;
                const usage     = k.currentUsage;
                const limit     = k.effectiveLimit;
                const pct       = Math.min(100, Math.round((usage / limit) * 100));

                return (
                  <tr key={k.id}>
                    <td style={cell}>
                      <div style={{ fontWeight: 600 }}>{k.name}</div>
                      <div style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 11 }}>{k.prefix}…</div>
                    </td>
                    <td style={cell}>{k.tenant.name}</td>
                    <td style={cell}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 6, background: "var(--border)", borderRadius: 3 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? "#ef4444" : pct > 50 ? "#f59e0b" : "#22c55e", borderRadius: 3 }} />
                        </div>
                        <span style={{ color: "var(--text-muted)" }}>{usage}/{limit}</span>
                      </div>
                    </td>
                    <td style={cell}>
                      {k.rateLimitPerMin != null
                        ? <span style={{ fontWeight: 600 }}>{k.rateLimitPerMin} req/dk</span>
                        : <span style={{ color: "var(--text-muted)" }}>100 (varsayılan)</span>
                      }
                    </td>
                    <td style={cell}>
                      <input
                        type="number"
                        min="1" max="10000"
                        value={isEditing ? editing[k.id] : (k.rateLimitPerMin ?? "")}
                        placeholder="100"
                        onChange={e => setEditing(prev => ({ ...prev, [k.id]: e.target.value }))}
                        style={{
                          width: 90, padding: "5px 8px", borderRadius: 6, fontSize: 12,
                          border: `1px solid ${isEditing ? "var(--accent)" : "var(--border)"}`,
                          background: "var(--bg-card)", color: "var(--text)", outline: "none",
                        }}
                      />
                    </td>
                    <td style={cell}>
                      {isEditing && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => save(k)}
                            disabled={busy === k.id}
                            style={{ padding: "4px 12px", fontSize: 11, borderRadius: 5, cursor: "pointer", background: "var(--accent)", border: "none", color: "#fff", fontWeight: 600 }}
                          >
                            {busy === k.id ? "…" : "Kaydet"}
                          </button>
                          <button
                            onClick={() => setEditing(prev => { const n = { ...prev }; delete n[k.id]; return n; })}
                            style={{ padding: "4px 10px", fontSize: 11, borderRadius: 5, cursor: "pointer", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                          >İptal</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminApiPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "8px 18px", fontSize: 13, fontWeight: 500,
    borderRadius: "6px 6px 0 0", cursor: "pointer", border: "none",
    borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
    background: "transparent",
    color: tab === t ? "var(--accent)" : "var(--text-muted)",
    transition: "color 0.15s",
  });

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>API İzleme</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
          Tüm tenant'lardaki API anahtarları, istek logları ve hız limitleri
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} style={tabStyle(t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview"  && <OverviewTab />}
      {tab === "keys"      && <KeysTab />}
      {tab === "requests"  && <RequestsTab />}
      {tab === "limits"    && <LimitsTab />}
    </div>
  );
}
