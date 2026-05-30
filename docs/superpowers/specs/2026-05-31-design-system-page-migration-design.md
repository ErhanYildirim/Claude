# Design System — Sayfa Migrasyonu Design Spec

**Tarih:** 2026-05-31
**Kapsam:** Mevcut 48 sayfanın design system token'larına ve component library'ye tam geçişi

---

## Hedef

Voltfox web app'indeki tüm mevcut sayfalar şu an hardcoded hex renk, sabit border-radius ve ham HTML elemanları kullanıyor. Bu spec; renkleri CSS token'larına, spacing/radius değerlerini token'lara ve uygun HTML elemanlarını component library bileşenlerine geçirmeyi tanımlar. Sonuçta tüm sayfalar dark mode'da doğru görünmeli ve design system'den bağımsız renk değeri bulundurmamalıdır.

**Kapsam dışı:**
- `EsgCanvasReportPage.tsx` — zaten token kullanıyor
- `EsgPlaygroundPage.tsx` — React Flow canvas, ayrı kapsam
- Recharts iç renkleri (kütüphane kendi yönetiyor)
- Animasyon / transition değerleri

---

## Tier Yapısı

### Tier 1 — Core journey (7 sayfa)
`DashboardPage`, `InstallationDetailPage`, `PeriodDetailPage`, `SettingsPage`, `LoginPage`, `ProfilePage`, `OnboardingPage`

### Tier 2 — Ana ürünler (15 sayfa)
**CBAM:** `CbamPage`, `CbamWizardPage`, `CbamFacilityPage`, `CbamProductPage`, `CbamReportPage`
**CFE:** `CfePage`, `CfeMatchingPage`, `CfeDataEntryPage`, `CfeCertificatesPage`, `CfeFacilitiesPage`, `CfeGreenAssetsPage`
**Raporlar:** `GhgProtocolPage`, `Iso14064Page`, `GecPage`, `CsrdReportPage`, `CdpReportPage`

### Tier 3 — İkincil özellikler (16 sayfa)
`BenchmarkPage`, `ComparisonPage`, `EmissionTargetsPage`, `CarbonPricePage`, `ImportWizardPage`, `EfDataPage`, `EfZonesPage`, `EfCoveragePage`, `EfApiPage`, `IntegrationsPage`, `ApiPlaygroundPage`, `LiveForecastHubPage`, `live/DamPriceChartPage`, `live/GenerationChartPage`, `live/CarbonIntensityPage`, `live/OptimalWindowPage`

### Tier 4 — Admin + utility (10 sayfa)
`admin/AdminDashboardPage`, `admin/AdminUsersPage`, `admin/AdminTenantsPage`, `admin/AdminApiPage`, `admin/AdminSmtpPage`, `admin/AdminAnnouncementsPage`, `admin/AdminWebhooksPage`, `admin/AdminEfDataPage`, `SharePage`, `InvitePage`

---

## Teknik Geçiş Kuralları

### 1. Renk Token Eşlemesi

| Hardcoded değer | Token |
|---|---|
| `#0a1f1a`, `#1a3530`, `#111` | `var(--text-primary)` |
| `#5c7a72`, `#6b9e88`, `#7a9e8e` | `var(--text-muted)` |
| `#2d6b52`, `#3d7a62` | `var(--text-secondary)` |
| `#fff`, `#ffffff` | `var(--bg-surface)` |
| `#f0f7f4`, `#eef7f3`, `#f5faf7` | `var(--bg-base)` veya `var(--bg-elevated)` |
| `#e8f3ed`, `#e6f9f2` | `var(--bg-subtle)` veya `var(--accent-bg)` |
| `#d4ece4`, `rgba(0,0,0,0.08)`, `#e0ede8` | `var(--border)` |
| `rgba(0,168,102,0.15)` | `var(--border-accent)` |
| `#00a866`, `#009966`, `#00b87a`, `#00c87a` | `var(--accent)` |
| `rgba(0,168,102,0.10)` | `var(--accent-bg)` |
| `#dc2626`, `#ef4444` | `var(--danger)` |
| `#d97706`, `#f59e0b` | `var(--warning)` |
| `#16a34a`, `#22c55e` | `var(--success)` |
| `#2563eb`, `#3b82f6` | `var(--info)` |
| `#92400e` | `var(--warning)` + opacity veya `var(--text-muted)` |
| `#fffbeb`, `#fef3c7` | `var(--bg-subtle)` (warning context) |
| `#fcd34d`, `#fde68a` | `var(--warning)` + opacity |

### 2. Spacing / Radius Token Eşlemesi

| Hardcoded değer | Token |
|---|---|
| `borderRadius: 4` | `var(--radius-sm)` |
| `borderRadius: 6`, `borderRadius: 7`, `borderRadius: 8` | `var(--radius-md)` |
| `borderRadius: 10`, `borderRadius: 12` | `var(--radius-lg)` |
| `borderRadius: 9999`, `borderRadius: "50%"` (pill) | `var(--radius-pill)` |
| `boxShadow: "0 1px 2px ..."` | `var(--shadow-sm)` |
| `boxShadow: "0 4px 12px ..."` | `var(--shadow-md)` |

### 3. Component Library Geçişi

**Button:**
- `<button onClick={...} style={{background:"#00a866",...}}>` → `<Button variant="primary">`
- `<button onClick={...} style={{background:"transparent", border:"1px solid...",...}}>` → `<Button variant="secondary">`
- `<button onClick={...} style={{background:"none",...}}>` → `<Button variant="ghost">`
- `<button onClick={...} style={{background:"#dc2626",...}}>` → `<Button variant="danger">`
- `import { Button } from "../components/ui/index.js"`

**Card:**
- `<div style={{background:"#fff", borderRadius:10, border:"1px solid #d4ece4",...}}>` → `<Card>`
- `<div style={{background:"#fff", borderRadius:10, border:"2px solid #00a866",...}}>` → `<Card variant="accent">`
- `<div style={{background:"#f0f7f4", borderRadius:10,...}}>` → `<Card variant="flat">`
- `import { Card } from "../components/ui/index.js"`

**Badge:**
- Durum göstergeleri (aktif/pasif, onaylı/bekleyen, hata/başarı) → `<Badge variant="success|warning|danger|info|neutral">`
- `import { Badge } from "../components/ui/index.js"`

**Input:**
- `<input type="text" style={{...}} placeholder="...">` + label kombinasyonları → `<Input label="..." placeholder="..." error="...">`
- `import { Input } from "../components/ui/index.js"`

**StatCard:**
- KPI metrik kutucukları (değer + label + opsiyonel delta) → `<StatCard label="..." value="..." delta={...}>`
- `import { StatCard } from "../components/ui/index.js"`

**Kullanılmayacaklar:** `Tabs`, `DataTable` — mevcut sayfalardaki özel implementasyonlar bırakılabilir, zorlanmaz.

---

## Uygulama Stratejisi

### Branch Planı
```
master
  └── feat/ds-tier-1  → merge → master
  └── feat/ds-tier-2  → merge → master
  └── feat/ds-tier-3  → merge → master
  └── feat/ds-tier-4  → merge → master
```

### Her Sayfa İçin Subagent Adımları
1. Sayfayı oku
2. Hardcoded renk → token değişikliği
3. Hardcoded radius/shadow → token değişikliği
4. Uygun HTML elemanları → component library
5. TypeScript hatasız
6. Commit: `feat(ds-tier-N): PageName token + component geçişi`

### Tier Tamamlanma Kriteri
- `npx tsc --noEmit` hatasız
- `npx vitest run` — mevcut testler geçiyor
- Branch master'a merge edildi

### İstisna Kuralları
- Recharts `<Bar fill="...">`, `<Line stroke="...">` gibi prop'lara dokunulmaz
- `style={{ color: someVariable }}` — değişkene bağlı inline style'lar kapsam dışı
- React Flow node stilleri kapsam dışı
- Çok karmaşık formlar (CbamWizardPage gibi) — Button/Input geçişi yapılır ama layout değişmez

---

## Başarı Kriterleri

1. Tüm 48 sayfada `grep "#[0-9a-fA-F]{3,6}"` sıfır hardcoded renk döner (Recharts hariç)
2. Dark mode toggle'da tüm sayfalar tutarlı görünür
3. TypeScript hatasız
4. Mevcut 32 test geçiyor
