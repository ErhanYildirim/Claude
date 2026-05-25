import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import type { MarketPriceLatest, EfLive, GenerationSummary } from "../lib/api.js";
import { ENTSO_ZONES } from "../constants/zones.js";

// Lazy chart pages
import DamPriceChartPage     from "./live/DamPriceChartPage.js";
import GenerationChartPage   from "./live/GenerationChartPage.js";
import CarbonIntensityPage   from "./live/CarbonIntensityPage.js";
import OptimalWindowPage     from "./live/OptimalWindowPage.js";

const DEFAULT_ZONE = "DE";

// WS live update tipini inline tanımla (api.ts'e eklemek gerekmez)
interface WsLiveUpdate {
  type:          "update";
  zone:          string;
  ts:            string;
  ci:            number | null;
  ciTrend1h:     number | null;
  rePct:         number | null;
  price:         number | null;
  priceForecast: number | null;
}

export default function LiveForecastHubPage() {
  const [zone, setZone]             = useState(DEFAULT_ZONE);
  const [lastSync, setLastSync]     = useState<Date | null>(null);
  const [priceData, setPriceData]   = useState<MarketPriceLatest | null>(null);
  const [efLive, setEfLive]         = useState<EfLive | null>(null);
  const [genSummary, setGenSummary] = useState<GenerationSummary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef   = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [price, ef, gen] = await Promise.allSettled([
        api.marketPrices.getLatest(zone),
        api.efLive.getLive(zone),
        api.generation.getSummary(zone),
      ]);
      if (price.status === "fulfilled") setPriceData(price.value);
      if (ef.status    === "fulfilled") setEfLive(ef.value);
      if (gen.status   === "fulfilled") setGenSummary(gen.value);
      setLastSync(new Date());
    } finally {
      setLoading(false);
    }
  }, [zone]);

  // İlk yükleme + zone değişimi REST fetch
  useEffect(() => { refresh(); }, [refresh]);

  // WebSocket bağlantısı — zone değiştiğinde yeniden kur
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function connectWs() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return startPolling();

        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        const host  = window.location.host;
        const url   = `${proto}://${host}/api/v1/ws/live?zone=${zone}&token=${session.access_token}`;

        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => setWsConnected(true);

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as { type: string } & WsLiveUpdate;
            if (msg.type !== "update") return;
            setLastSync(new Date(msg.ts));
            if (msg.ci != null || msg.rePct != null) {
              setEfLive(prev => prev ? {
                ...prev,
                currentCi:   msg.ci,
                currentRePct: msg.rePct,
                trend1h:     msg.ciTrend1h,
              } : null);
            }
            if (msg.price != null) {
              setPriceData(prev => prev ? {
                ...prev,
                current: { actual: msg.price, forecast: msg.priceForecast ?? prev.current.forecast },
              } : null);
            }
          } catch { /* ignore parse errors */ }
        };

        ws.onerror = () => {
          setWsConnected(false);
          startPolling();
        };

        ws.onclose = () => setWsConnected(false);
      } catch {
        startPolling();
      }
    }

    function startPolling() {
      pollTimer = setInterval(refresh, 5 * 60 * 1000);
    }

    connectWs();

    return () => {
      ws?.close();
      wsRef.current = null;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [zone, refresh]);

  // Zone değiştiğinde açık WS'e subscribe mesajı gönder (bağlantı kesilmeden)
  function changeZone(newZone: string) {
    setZone(newZone);
    navigate("/live-forecast");
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", zone: newZone }));
    }
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const bg     = isDark ? "#0f1117" : "#f8fafc";
  const card   = isDark ? "#1a1d27" : "#ffffff";
  const text   = isDark ? "#f1f5f9" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#2d3748" : "#e2e8f0";

  const currentCi      = efLive?.currentCi;
  const avgDamPrice    = priceData?.summary.avgActual24h;
  const avgRePct       = genSummary?.summary.avgRePct;

  function ciColor(ci: number | null | undefined): string {
    if (!ci) return sub;
    if (ci < 100) return "#10b981";
    if (ci < 250) return "#f59e0b";
    if (ci < 450) return "#ef4444";
    return "#7f1d1d";
  }

  return (
    <div style={{ background: bg, minHeight: "100%", padding: "20px 24px" }}>
      {/* Üst bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: text }}>
            Canlı & Tahmin
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: sub }}>
            Piyasa fiyatları, yenilenebilir üretim ve karbon yoğunluğu — gerçek zamanlı ve D+1 tahmini
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Zone seçici */}
          <select
            value={zone}
            onChange={e => changeZone(e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: 8, border: `1px solid ${border}`,
              background: card, color: text, fontSize: 13, cursor: "pointer",
            }}
          >
            {ENTSO_ZONES.map(z => (
              <option key={z.code} value={z.code}>{z.code} — {z.name}</option>
            ))}
          </select>

          {/* Canlı göstergesi */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: sub }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: wsConnected ? "#10b981" : "#f59e0b",
              boxShadow: wsConnected
                ? "0 0 0 2px rgba(16,185,129,0.3)"
                : "0 0 0 2px rgba(245,158,11,0.3)",
            }} />
            {wsConnected ? "WS Canlı · " : "Polling · "}
            {lastSync
              ? lastSync.toLocaleTimeString("tr-TR")
              : "Yükleniyor…"
            }
          </div>

          <button
            onClick={refresh}
            style={{
              padding: "6px 12px", borderRadius: 8, border: `1px solid ${border}`,
              background: card, color: text, fontSize: 13, cursor: "pointer",
            }}
          >
            ↺ Yenile
          </button>
        </div>
      </div>

      {/* KPI kartları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <KpiCard
          label="Anlık Karbon Yoğunluğu"
          value={currentCi != null ? `${currentCi.toFixed(0)} gCO₂/kWh` : "—"}
          sub={efLive?.trend1h != null
            ? `${efLive.trend1h > 0 ? "+" : ""}${efLive.trend1h.toFixed(1)} son 1s`
            : undefined}
          color={ciColor(currentCi)}
          card={card} text={text} subColor={sub} border={border}
        />
        <KpiCard
          label="Bugün Ort. DAM Fiyatı"
          value={avgDamPrice != null ? `${avgDamPrice.toFixed(2)} EUR/MWh` : "—"}
          sub={zone === "TR" && priceData?.current.actual != null
            ? `${(priceData.current.actual * 34).toFixed(0)} TRY/MWh (tahmini)` : undefined}
          color="#3b82f6"
          card={card} text={text} subColor={sub} border={border}
        />
        <KpiCard
          label="Yenilenebilir Enerji Payı"
          value={avgRePct != null ? `${avgRePct.toFixed(1)}%` : "—"}
          sub={genSummary?.summary.peakSolarHour
            ? `Peak güneş: ${new Date(genSummary.summary.peakSolarHour).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`
            : undefined}
          color="#10b981"
          card={card} text={text} subColor={sub} border={border}
        />
      </div>

      {/* Sekme içeriği */}
      <Routes>
        <Route index                   element={<DamPriceChartPage   zone={zone} />} />
        <Route path="generation"       element={<GenerationChartPage zone={zone} />} />
        <Route path="carbon"           element={<CarbonIntensityPage zone={zone} />} />
        <Route path="optimal"          element={<OptimalWindowPage   zone={zone} />} />
      </Routes>
    </div>
  );
}

function KpiCard({ label, value, sub, color, card, text, subColor, border }: {
  label: string; value: string; sub?: string;
  color: string; card: string; text: string; subColor: string; border: string;
}) {
  return (
    <div style={{
      background: card, border: `1px solid ${border}`, borderRadius: 12,
      padding: "16px 20px", borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 12, color: subColor, fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: subColor, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
