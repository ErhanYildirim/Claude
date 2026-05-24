import { useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

// ── Endpoint catalog ──────────────────────────────────────────────────────────
interface Endpoint {
  id:       string;
  method:   "GET" | "POST" | "PATCH" | "DELETE";
  path:     string;
  label:    string;
  body?:    string;
  note?:    string;
}

const ENDPOINTS: { group: string; items: Endpoint[] }[] = [
  {
    group: "Tesisler (Installations)",
    items: [
      { id: "inst-list",   method: "GET",    path: "/api/v1/installations",              label: "Tesis listesi" },
      { id: "inst-create", method: "POST",   path: "/api/v1/installations",              label: "Tesis oluştur",
        body: JSON.stringify({ facilityName: "Test Tesisi", operator: "Test A.Ş.", facilityCountry: "TR", sector: "steel" }, null, 2) },
      { id: "inst-get",    method: "GET",    path: "/api/v1/installations/:id",          label: "Tesis detayı",       note: ":id yerine UUID girin" },
      { id: "inst-update", method: "PATCH",  path: "/api/v1/installations/:id",          label: "Tesis güncelle",     note: ":id yerine UUID girin",
        body: JSON.stringify({ facilityName: "Güncel İsim" }, null, 2) },
      { id: "inst-delete", method: "DELETE", path: "/api/v1/installations/:id",          label: "Tesis sil",          note: ":id yerine UUID girin" },
    ],
  },
  {
    group: "Dönemler (Periods)",
    items: [
      { id: "period-create", method: "POST",   path: "/api/v1/installations/:id/periods", label: "Dönem oluştur",      note: ":id yerine tesis UUID",
        body: JSON.stringify({ periodName: "2024-Q1", startDate: "2024-01-01", endDate: "2024-03-31", reportYear: 2024, importCountry: "DE", cnCode: "7206100000", prodVolumeTonne: 1000, scope1DirectTco2: 450, scope1Quality: "measured", electricityKwh: 500000, baselineEf: 0.4, renewableEf: 0.0, matchingRatePct: 0 }, null, 2) },
      { id: "period-calc",   method: "POST",   path: "/api/v1/installations/:iid/periods/:pid/calculate", label: "SEE Hesapla",        note: ":iid tesis, :pid dönem UUID" },
      { id: "period-result", method: "GET",    path: "/api/v1/installations/:iid/periods/:pid/result",    label: "SEE Sonucu",         note: ":iid tesis, :pid dönem UUID" },
      { id: "period-delete", method: "DELETE", path: "/api/v1/installations/:iid/periods/:pid",           label: "Dönem sil",          note: ":iid tesis, :pid dönem UUID" },
    ],
  },
  {
    group: "24/7 CFE Matching",
    items: [
      { id: "cfe-get",    method: "GET",  path: "/api/v1/installations/:iid/periods/:pid/cfe",        label: "CFE sonucu",  note: ":iid tesis, :pid dönem UUID" },
      { id: "cfe-submit", method: "POST", path: "/api/v1/installations/:iid/periods/:pid/cfe",        label: "CFE hesapla", note: ":iid tesis, :pid dönem UUID",
        body: JSON.stringify({ slots: [{ hour: "2024-01-01T00:00:00Z", consumptionKwh: 100, productionKwh: 80 }, { hour: "2024-01-01T01:00:00Z", consumptionKwh: 90, productionKwh: 95 }], gecDataVersion: "2024.1" }, null, 2) },
    ],
  },
  {
    group: "Emisyon Faktörü (EF)",
    items: [
      { id: "ef-coverage",  method: "GET", path: "/api/v1/ef/coverage",      label: "EF kapsama özeti" },
      { id: "ef-zones",     method: "GET", path: "/api/v1/ef/zones",          label: "Şebeke listesi" },
      { id: "ef-import",    method: "GET", path: "/api/v1/ef/import-status",  label: "Import durumu" },
      { id: "ef-lookup",    method: "GET", path: "/api/v1/ef/lookup?zone=TR&year=2023&hour=2023-06-15T12:00:00Z", label: "Tek saat EF sorgusu" },
    ],
  },
  {
    group: "Paylaşım Linkleri",
    items: [
      { id: "share-create", method: "POST",   path: "/api/v1/share-links",      label: "Link oluştur",
        body: JSON.stringify({ installationId: "<uuid>", periodId: "<uuid>", ttlDays: 30, password: "" }, null, 2) },
      { id: "share-patch",  method: "PATCH",  path: "/api/v1/share-links/:jti", label: "Şifre/tarih güncelle", note: ":jti yerine jti değeri",
        body: JSON.stringify({ password: "yeniSifre", expiresAt: "2025-12-31T00:00:00Z" }, null, 2) },
      { id: "share-revoke", method: "DELETE", path: "/api/v1/share-links/:jti", label: "Link iptal et",         note: ":jti yerine jti değeri" },
    ],
  },
  {
    group: "Ekip & Üyeler",
    items: [
      { id: "members-list",   method: "GET",  path: "/api/v1/members",         label: "Üye listesi" },
      { id: "members-me",     method: "GET",  path: "/api/v1/members/me",      label: "Kendi rolüm" },
      { id: "members-invite", method: "POST", path: "/api/v1/members/invite",  label: "Davet gönder",
        body: JSON.stringify({ email: "user@example.com", role: "analyst" }, null, 2) },
      { id: "members-remove", method: "DELETE", path: "/api/v1/members/:userId", label: "Üye çıkar", note: ":userId yerine UUID" },
    ],
  },
  {
    group: "API Anahtarları",
    items: [
      { id: "apikeys-list",   method: "GET",    path: "/api/v1/api-keys",      label: "Anahtar listesi" },
      { id: "apikeys-create", method: "POST",   path: "/api/v1/api-keys",      label: "Anahtar oluştur",
        body: JSON.stringify({ name: "Test Entegrasyonu", scopes: ["ef:read"], expiresAt: null }, null, 2) },
      { id: "apikeys-revoke", method: "DELETE", path: "/api/v1/api-keys/:id",  label: "Anahtar sil", note: ":id yerine anahtar ID" },
    ],
  },
  {
    group: "Webhooks",
    items: [
      { id: "wh-list",   method: "GET",    path: "/api/v1/webhooks",     label: "Webhook listesi" },
      { id: "wh-create", method: "POST",   path: "/api/v1/webhooks",     label: "Webhook oluştur",
        body: JSON.stringify({ url: "https://example.com/hook", events: ["calculation.completed"] }, null, 2) },
      { id: "wh-delete", method: "DELETE", path: "/api/v1/webhooks/:id", label: "Webhook sil", note: ":id yerine webhook ID" },
    ],
  },
  {
    group: "Audit & Bildirimler",
    items: [
      { id: "audit-list", method: "GET", path: "/api/v1/audit",                        label: "Audit log" },
      { id: "notif-list", method: "GET", path: "/api/v1/notifications",                label: "Bildirimler" },
      { id: "notif-prefs",method: "GET", path: "/api/v1/notifications/preferences",    label: "Bildirim tercihleri" },
    ],
  },
  {
    group: "Tenant & Durum",
    items: [
      { id: "tenant",  method: "GET", path: "/api/v1/tenant",  label: "Tenant bilgisi" },
      { id: "status",  method: "GET", path: "/api/v1/status",  label: "API durumu" },
      { id: "health",  method: "GET", path: "/health",          label: "Sağlık kontrolü" },
    ],
  },
  {
    group: "CBAM Defaults",
    items: [
      { id: "defaults", method: "GET", path: "/api/v1/defaults?cnCode=7206100000&country=DE", label: "Default SEE değeri" },
    ],
  },
  {
    group: "Sektör Benchmark",
    items: [
      { id: "bench-list",    method: "GET", path: "/api/v1/benchmark",         label: "Tüm tesisler — benchmark karşılaştırma" },
      { id: "bench-sectors", method: "GET", path: "/api/v1/benchmark/sectors", label: "Sektör referans değerleri (public)" },
    ],
  },
  {
    group: "Emisyon Hedefleri",
    items: [
      { id: "target-list",     method: "GET",    path: "/api/v1/emission-targets",              label: "Hedef listesi" },
      { id: "target-progress", method: "GET",    path: "/api/v1/emission-targets/progress",     label: "Hedef ilerleme (gerçekleşen vs hedef)" },
      { id: "target-create",   method: "POST",   path: "/api/v1/emission-targets",              label: "Hedef oluştur / güncelle",
        body: JSON.stringify({ year: 2025, metric: "see_voltfox", targetValue: 0.3, baselineValue: 0.45, notes: "SEE azaltım hedefi" }, null, 2) },
      { id: "target-delete",   method: "DELETE", path: "/api/v1/emission-targets/:id",          label: "Hedef sil", note: ":id yerine hedef UUID" },
    ],
  },
  {
    group: "Karbon Fiyatları",
    items: [
      { id: "price-list",   method: "GET",    path: "/api/v1/carbon-prices",        label: "Fiyat geçmişi" },
      { id: "price-latest", method: "GET",    path: "/api/v1/carbon-prices/latest", label: "En güncel ETS/CBAM fiyatı" },
      { id: "price-create", method: "POST",   path: "/api/v1/carbon-prices",        label: "Fiyat ekle (super-admin)",
        body: JSON.stringify({ date: "2025-05-01", etsPriceEur: 65.40, cbamEstEur: 68.20, source: "ICE Endex", notes: "Aylık kapanış" }, null, 2) },
    ],
  },
  {
    group: "Arama",
    items: [
      { id: "search-all",  method: "GET", path: "/api/v1/search?q=çelik&type=all&limit=10",          label: "Genel arama (tesis + dönem)" },
      { id: "search-inst", method: "GET", path: "/api/v1/search?q=Türkiye&type=installation&limit=5", label: "Sadece tesis arama" },
    ],
  },
  {
    group: "Dönem CSV Import",
    items: [
      { id: "import-preview", method: "POST", path: "/api/v1/installations/:id/periods/import/preview", label: "CSV önizleme (doğrulama)", note: ":id yerine tesis UUID — multipart/form-data" },
      { id: "import-confirm", method: "POST", path: "/api/v1/installations/:id/periods/import/confirm", label: "CSV import onayla",         note: ":id yerine tesis UUID — multipart/form-data",
        body: JSON.stringify({ rows: [{ periodName: "2024-Q1", startDate: "2024-01-01", endDate: "2024-03-31", reportYear: 2024, importCountry: "DE", cnCode: "7206100000", prodVolumeTonne: 1000, scope1DirectTco2: 450, scope1Quality: "measured", electricityKwh: 500000, renewableEf: 0.0, matchingRatePct: 0 }] }, null, 2) },
    ],
  },
  {
    group: "CBAM Ürün Hesaplama",
    items: [
      { id: "cbam-ref",          method: "GET",    path: "/api/v1/cbam/reference",                                           label: "Referans veriler (kaynak EF, ülke EF)" },
      { id: "cbam-fac-list",     method: "GET",    path: "/api/v1/cbam/facilities",                                                                  label: "CBAM Tesis listesi" },
      { id: "cbam-fac-create",   method: "POST",   path: "/api/v1/cbam/facilities",                                                                  label: "CBAM Tesis oluştur",
        body: JSON.stringify({ facilityName: "Çelik Fabrikası", operator: "ACME A.Ş.", facilityCountry: "TR", sector: "steel" }, null, 2) },
      { id: "cbam-fac-get",      method: "GET",    path: "/api/v1/cbam/facilities/:fid",                                                             label: "CBAM Tesis detay",       note: ":fid CBAM tesis UUID" },
      { id: "cbam-fac-update",   method: "PATCH",  path: "/api/v1/cbam/facilities/:fid",                                                             label: "CBAM Tesis güncelle",    note: ":fid CBAM tesis UUID" },
      { id: "cbam-fac-delete",   method: "DELETE", path: "/api/v1/cbam/facilities/:fid",                                                             label: "CBAM Tesis sil",         note: ":fid CBAM tesis UUID (ürünler olmadığında)" },
      { id: "cbam-prod-list",    method: "GET",    path: "/api/v1/cbam/facilities/:fid/products",                                                    label: "Ürün listesi",           note: ":fid CBAM tesis UUID" },
      { id: "cbam-prod-create",  method: "POST",   path: "/api/v1/cbam/facilities/:fid/products",                                                    label: "Ürün oluştur",           note: ":fid CBAM tesis UUID",
        body: JSON.stringify({ productName: "Çelik Profil", cnCode: "7216", unit: "tonne", isCbamScope: true, energyAllocationMode: "facility" }, null, 2) },
      { id: "cbam-prod-update",  method: "PATCH",  path: "/api/v1/cbam/facilities/:fid/products/:pid",                                               label: "Ürün güncelle",          note: ":fid tesis, :pid ürün UUID" },
      { id: "cbam-prod-delete",  method: "DELETE", path: "/api/v1/cbam/facilities/:fid/products/:pid",                                               label: "Ürün sil",               note: ":fid tesis, :pid ürün UUID" },
      { id: "cbam-per-list",     method: "GET",    path: "/api/v1/cbam/facilities/:fid/products/:pid/periods",                                       label: "Ürün dönem listesi",     note: ":fid tesis, :pid ürün UUID" },
      { id: "cbam-per-create",   method: "POST",   path: "/api/v1/cbam/facilities/:fid/products/:pid/periods",                                       label: "Dönem oluştur (tesis modu)", note: ":fid tesis, :pid ürün UUID",
        body: JSON.stringify({ reportYear: 2024, periodName: "2024 Yılı", startDate: "2024-01-01", endDate: "2024-12-31", productionVolumeTonne: 5000, scope1DirectTco2: 1200, facilityTotalKwh: 800000, facilityRenewableKwh: 200000, productShareKwh: 400000, renewableSource: "solar", countryGridEf: 0.4943 }, null, 2) },
      { id: "cbam-per-create-b", method: "POST",   path: "/api/v1/cbam/facilities/:fid/products/:pid/periods",                                       label: "Dönem oluştur (band modu)", note: ":fid tesis, :pid ürün UUID",
        body: JSON.stringify({ reportYear: 2024, periodName: "2024 Yılı", startDate: "2024-01-01", endDate: "2024-12-31", productionVolumeTonne: 5000, scope1DirectTco2: 1200, bandElectricityKwh: 400000, bandRenewableKwh: 100000, renewableSource: "wind_onshore", countryGridEf: 0.4943 }, null, 2) },
      { id: "cbam-per-update",   method: "PATCH",  path: "/api/v1/cbam/facilities/:fid/products/:pid/periods/:perid",                                label: "Dönem güncelle",         note: ":fid tesis, :pid ürün, :perid dönem UUID",
        body: JSON.stringify({ productionVolumeTonne: 5200, scope1DirectTco2: 1250, facilityTotalKwh: 850000 }, null, 2) },
      { id: "cbam-per-delete",   method: "DELETE", path: "/api/v1/cbam/facilities/:fid/products/:pid/periods/:perid",                                label: "Dönem sil",              note: ":fid tesis, :pid ürün, :perid dönem UUID" },
      { id: "cbam-per-calc",     method: "POST",   path: "/api/v1/cbam/facilities/:fid/products/:pid/periods/:perid/calculate",                      label: "SEE Hesapla",            note: ":fid tesis, :pid ürün, :perid dönem UUID" },
      { id: "cbam-grid-ef",      method: "GET",    path: "/api/v1/cbam/grid-ef?country=TR&year=2024",                        label: "ENTSO-E Izgara EF",      note: "Yıllık ortalama EF (tCO₂/MWh)" },
    ],
  },
];

const METHOD_COLORS: Record<string, { bg: string; color: string }> = {
  GET:    { bg: "#D1FAE5", color: "#065F46" },
  POST:   { bg: "#DBEAFE", color: "#1D4ED8" },
  PATCH:  { bg: "#FEF3C7", color: "#92400E" },
  DELETE: { bg: "#FEE2E2", color: "#DC2626" },
};

interface Response { status: number; ms: number; body: unknown; ok: boolean; }

const s: Record<string, React.CSSProperties> = {
  layout:   { display: "flex", gap: 0, height: "calc(100vh - 0px)", overflow: "hidden" },
  sidebar:  { width: 260, flexShrink: 0, borderRight: "1px solid #d4ece4", overflowY: "auto", background: "#fff" },
  main:     { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  group:    { padding: "10px 12px 4px", fontSize: 10, fontWeight: 700, color: "#5c7a72", textTransform: "uppercase" as const, letterSpacing: ".08em" },
  epItem:   { display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", cursor: "pointer", transition: "background .12s", fontSize: 12 },
  epLabel:  { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  badge:    { display: "inline-block", padding: "2px 5px", borderRadius: 4, fontSize: 10, fontWeight: 700, flexShrink: 0 },
  topBar:   { padding: "14px 20px", borderBottom: "1px solid #d4ece4", background: "#fff", display: "flex", alignItems: "center", gap: 10 },
  urlInput: { flex: 1, padding: "8px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, outline: "none", fontFamily: "monospace" },
  sendBtn:  { padding: "8px 22px", background: "#00b87a", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 13 },
  body:     { flex: 1, display: "flex", overflow: "hidden" },
  reqPane:  { width: "45%", display: "flex", flexDirection: "column", borderRight: "1px solid #d4ece4", overflow: "hidden" },
  resPane:  { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  paneHead: { padding: "10px 16px", fontSize: 12, fontWeight: 700, color: "#5c7a72", background: "#f4fbf8", borderBottom: "1px solid #d4ece4", display: "flex", alignItems: "center", gap: 8 },
  textarea: { flex: 1, padding: "12px 16px", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, border: "none", outline: "none", resize: "none" as const, overflowY: "auto" as const },
  pre:      { flex: 1, margin: 0, padding: "12px 16px", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, overflowY: "auto" as const, whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const, background: "#fff" },
  empty:    { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#5c7a72", fontSize: 13 },
  note:     { fontSize: 11, color: "#5c7a72", padding: "4px 16px", borderBottom: "1px solid #f0f9f5", background: "#f8fffe" },
};

export default function ApiPlaygroundPage() {
  const [selected, setSelected]   = useState<Endpoint>(ENDPOINTS[0].items[0]);
  const [url,       setUrl]       = useState("/api/v1/installations");
  const [body,      setBody]      = useState("");
  const [response,  setResponse]  = useState<Response | null>(null);
  const [loading,   setLoading]   = useState(false);
  const startRef                  = useRef<number>(0);

  function pick(ep: Endpoint) {
    setSelected(ep);
    setUrl(ep.path);
    setBody(ep.body ?? "");
    setResponse(null);
  }

  async function send() {
    setLoading(true);
    setResponse(null);
    startRef.current = performance.now();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session) headers["Authorization"] = `Bearer ${session.access_token}`;
      const hasBody = ["POST", "PATCH", "PUT"].includes(selected.method) && body.trim();
      if (hasBody) headers["Content-Type"] = "application/json";

      const res = await fetch(url, {
        method:  selected.method,
        headers,
        body:    hasBody ? body : undefined,
      });

      const ms    = Math.round(performance.now() - startRef.current);
      let parsed: unknown;
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        parsed = await res.json().catch(() => null);
      } else {
        parsed = await res.text().catch(() => "");
      }

      setResponse({ status: res.status, ms, body: parsed, ok: res.ok });
    } catch (e: unknown) {
      const ms = Math.round(performance.now() - startRef.current);
      setResponse({ status: 0, ms, body: { error: e instanceof Error ? e.message : "Ağ hatası" }, ok: false });
    }
    setLoading(false);
  }

  const methodStyle = METHOD_COLORS[selected.method] ?? METHOD_COLORS.GET;

  return (
    <div style={s.layout}>
      {/* ── Endpoint sidebar ── */}
      <div style={s.sidebar}>
        <div style={{ padding: "14px 12px 6px", borderBottom: "1px solid #d4ece4" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0a1f1a" }}>API Playground</div>
          <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 2 }}>{ENDPOINTS.flatMap(g => g.items).length} endpoint</div>
        </div>

        {ENDPOINTS.map(group => (
          <div key={group.group}>
            <div style={s.group}>{group.group}</div>
            {group.items.map(ep => {
              const mc = METHOD_COLORS[ep.method];
              const active = selected.id === ep.id;
              return (
                <div
                  key={ep.id}
                  style={{ ...s.epItem, background: active ? "#e6f9f2" : "transparent" }}
                  onClick={() => pick(ep)}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#f4fbf8"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{ ...s.badge, background: mc.bg, color: mc.color }}>{ep.method}</span>
                  <span style={{ ...s.epLabel, color: active ? "#00b87a" : "#1a3530", fontWeight: active ? 700 : 400 }}>
                    {ep.label}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Main panel ── */}
      <div style={s.main}>
        {/* URL bar */}
        <div style={s.topBar}>
          <span style={{ ...s.badge, background: methodStyle.bg, color: methodStyle.color, fontSize: 12, padding: "5px 10px" }}>
            {selected.method}
          </span>
          <input
            style={s.urlInput}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            spellCheck={false}
          />
          <button style={{ ...s.sendBtn, opacity: loading ? 0.7 : 1 }} onClick={send} disabled={loading}>
            {loading ? "..." : "Gönder"}
          </button>
        </div>

        {selected.note && (
          <div style={s.note}>{selected.note}</div>
        )}

        {/* Request + Response panes */}
        <div style={s.body}>
          {/* Request body */}
          <div style={s.reqPane}>
            <div style={s.paneHead}>
              <span>İstek Gövdesi (JSON)</span>
              {!["POST", "PATCH", "PUT"].includes(selected.method) && (
                <span style={{ color: "#94A3B8", fontWeight: 400 }}>— Bu method için gövde gönderilmez</span>
              )}
            </div>
            <textarea
              style={{ ...s.textarea, background: ["POST", "PATCH", "PUT"].includes(selected.method) ? "#fff" : "#f8f9fa", color: "#1a3530" }}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={["POST", "PATCH", "PUT"].includes(selected.method) ? '{\n  "key": "value"\n}' : "—"}
              readOnly={!["POST", "PATCH", "PUT"].includes(selected.method)}
              spellCheck={false}
            />
          </div>

          {/* Response */}
          <div style={s.resPane}>
            <div style={s.paneHead}>
              <span>Yanıt</span>
              {response && (
                <>
                  <span style={{
                    background: response.ok ? "#D1FAE5" : "#FEE2E2",
                    color:      response.ok ? "#065F46" : "#DC2626",
                    padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700,
                  }}>
                    {response.status || "Hata"}
                  </span>
                  <span style={{ color: "#94A3B8", fontWeight: 400 }}>{response.ms} ms</span>
                </>
              )}
            </div>
            {!response && !loading && (
              <div style={s.empty}>Gönder tuşuna basın</div>
            )}
            {loading && (
              <div style={s.empty}>İstek gönderiliyor...</div>
            )}
            {response && (
              <pre style={s.pre}>
                {JSON.stringify(response.body, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
