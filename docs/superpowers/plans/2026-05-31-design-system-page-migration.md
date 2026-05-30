# Design System — Sayfa Migrasyonu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 48 mevcut sayfayı design system token'larına ve component library'ye geçir; hardcoded renk, radius ve ham HTML elemanlarını sıfıra indir.

**Architecture:** Tier'lı yaklaşım — önce core journey (T1), sonra ürün sayfaları (T2), ikincil özellikler (T3), admin/utility (T4). Her tier kendi branch'inde çalışır ve tamamlandığında master'a merge edilir.

**Tech Stack:** React 18, TypeScript, CSS Variables (`tokens.css`), `components/ui/` (Button, Card, Badge, Input, StatCard)

---

## Genel Migrasyon Kuralları (Her Task İçin Geçerli)

### Renk Token Eşlemesi
```
#0a1f1a | #1a3530 | #111827         → var(--text-primary)
#5c7a72 | #6b9e88 | #7a9e8e         → var(--text-muted)
#2d6b52 | #3d7a62                   → var(--text-secondary)
#fff | #ffffff                       → var(--bg-surface)
#f0f7f4 | #eef7f3 | #f5faf7         → var(--bg-base) veya var(--bg-elevated)
#e8f3ed | #e6f9f2                   → var(--bg-subtle) veya var(--accent-bg)
#d4ece4 | rgba(0,0,0,0.08)          → var(--border)
rgba(0,168,102,0.15)                → var(--border-accent)
#00a866 | #009966 | #00b87a         → var(--accent)
rgba(0,168,102,0.10)                → var(--accent-bg)
#dc2626 | #ef4444                   → var(--danger)
#d97706 | #f59e0b                   → var(--warning)
#16a34a | #22c55e                   → var(--success)
#2563eb | #3b82f6                   → var(--info)
#fffbeb | #fef3c7 (warning bg)      → var(--bg-subtle)
#fcd34d | #fde68a (warning border)  → var(--warning)
#92400e (warning text)              → var(--warning)
```

### Radius / Shadow Token Eşlemesi
```
borderRadius: 4                     → var(--radius-sm)
borderRadius: 6 | 7 | 8             → var(--radius-md)
borderRadius: 10 | 12               → var(--radius-lg)
borderRadius: 9999 | "50%"          → var(--radius-pill)
boxShadow: "0 1px 2px ..."          → var(--shadow-sm)
boxShadow: "0 4px 12px ..."         → var(--shadow-md)
```

### Component Library Geçişi

**Import — pages/ dizini için:**
```tsx
import { Button, Card, Badge, Input, StatCard } from "../components/ui/index.js";
```
**Import — pages/admin/ veya pages/live/ için:**
```tsx
import { Button, Card, Badge, Input, StatCard } from "../../components/ui/index.js";
```

**Button dönüşümü:**
```tsx
// Önce
<button onClick={fn} style={{ background: "#00a866", color: "#fff", borderRadius: 8, padding: "8px 16px", border: "none" }}>
  Kaydet
</button>

// Sonra
<Button variant="primary" onClick={fn}>Kaydet</Button>

// Secondary (border + bg-elevated)
<Button variant="secondary" onClick={fn}>İptal</Button>

// Ghost (transparent border)
<Button variant="ghost" onClick={fn}>Detay</Button>

// Danger
<Button variant="danger" onClick={fn}>Sil</Button>

// Küçük boyut
<Button variant="secondary" size="sm" onClick={fn}>Düzenle</Button>
```

**Card dönüşümü:**
```tsx
// Önce
<div style={{ background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px" }}>
  ...
</div>

// Sonra
<Card>...</Card>

// Accent (yeşil kenarlık)
<Card variant="accent">...</Card>

// Flat (arka plan koyu, kenarlıksız)
<Card variant="flat">...</Card>

// Card içinde ek style
<Card style={{ marginBottom: 16 }}>...</Card>
```

**Badge dönüşümü:**
```tsx
// Önce
<span style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a", border: "...", borderRadius: 9999, fontSize: 11, padding: "2px 8px" }}>
  Aktif
</span>

// Sonra
<Badge variant="success">Aktif</Badge>
<Badge variant="warning">Bekliyor</Badge>
<Badge variant="danger">Hata</Badge>
<Badge variant="accent">Yeni</Badge>
<Badge variant="neutral">Pasif</Badge>
```

**StatCard dönüşümü:**
```tsx
// Önce (KPI kutusu pattern)
<div style={{ background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px" }}>
  <div style={{ fontSize: 11, color: "#5c7a72", fontWeight: 700, textTransform: "uppercase" }}>Toplam Emisyon</div>
  <div style={{ fontSize: 26, fontWeight: 800, color: "#0a1f1a" }}>1,240</div>
  <div style={{ fontSize: 11, color: "#5c7a72" }}>tCO₂e</div>
</div>

// Sonra
<StatCard label="Toplam Emisyon" value="1,240" unit="tCO₂e" />

// Delta ile
<StatCard label="Emisyon" value="1,240" unit="tCO₂e" delta={{ value: 12, direction: "down", label: "geçen döneme göre" }} />
```

**Input dönüşümü:**
```tsx
// Önce
<label style={{ fontSize: 12, color: "#5c7a72" }}>İsim</label>
<input type="text" value={v} onChange={...} style={{ border: "1px solid #d4ece4", borderRadius: 8, padding: "8px 12px", width: "100%" }} />

// Sonra
<Input label="İsim" value={v} onChange={...} />

// Hata ile
<Input label="E-posta" value={v} onChange={...} error="Geçersiz format" />
```

### Kapsam Dışı (Dokunmayacaklar)
- Recharts prop'ları: `<Bar fill="...">`, `<Line stroke="...">`, `<XAxis tick={{ fill: "..." }}>` — kütüphane renklerine dokunma
- `style={{ color: someVariable }}` — değişkene bağlı inline style'lar
- React Flow node stilleri
- `animation`, `transition`, `transform` değerleri
- `width`, `height`, `margin`, `padding` sayısal değerleri (sadece borderRadius ve renk token'a geçer)

---

## TIER 1 — Core Journey

### Task 1: Branch Oluştur (Tier 1)

**Files:** —

- [ ] **Step 1: Branch oluştur**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git checkout -b feat/ds-tier-1
```

Beklenen: `Switched to a new branch 'feat/ds-tier-1'`

---

### Task 2: DashboardPage

**Files:**
- Modify: `apps/web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Dosyayı oku, hardcoded değerleri listele**

`apps/web/src/pages/DashboardPage.tsx` dosyasını oku. Sayfanın başındaki `const s = {...}` bloğunu ve inline style'ları incele.

- [ ] **Step 2: Renk + radius token'larını uygula**

`const s` bloğundaki tüm hardcoded renkleri ve borderRadius değerlerini Genel Migrasyon Kuralları tablosuna göre token'lara çevir.

Dikkat: `recharts` bileşenlerine (`BarChart`, `LineChart`, `XAxis`, `YAxis`, vb.) verilen renk prop'larına **dokunma**.

Örnek dönüşüm:
```tsx
// Önce
h1: { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
kpi: { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px" },

// Sonra
h1: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 },
kpi: { background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", padding: "18px 20px" },
```

- [ ] **Step 3: Component library geçişi**

Sayfadaki button'ları `<Button>`, alert div'lerini `<Card variant="flat">`, KPI kutularını `<StatCard>` ile değiştir.

`import` satırına ekle:
```tsx
import { Button, Card, StatCard, Badge } from "../components/ui/index.js";
```

KPI grid'deki her kart `<StatCard>` olabilir. Alert kutucukları (uyarı rengi taşıyorsa) `<Card variant="flat">` veya token'lı div olarak bırakılabilir.

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx tsc --noEmit
```

Beklenen: hata yok

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/DashboardPage.tsx
git commit -m "feat(ds-tier-1): DashboardPage token + component geçişi"
```

---

### Task 3: InstallationDetailPage

**Files:**
- Modify: `apps/web/src/pages/InstallationDetailPage.tsx`

- [ ] **Step 1: Dosyayı oku**

`apps/web/src/pages/InstallationDetailPage.tsx` dosyasını oku. Style objelerini ve inline style'ları incele. (~69 hardcoded renk var)

- [ ] **Step 2: Renk + radius token'larını uygula**

Tüm hardcoded hex renkleri ve borderRadius değerlerini token'lara çevir.

- [ ] **Step 3: Component library geçişi**

- Action button'ları → `<Button variant="primary|secondary|ghost|danger">`
- Section card'ları → `<Card>`
- Durum göstergeleri (aktif/pasif/hata) → `<Badge variant="success|warning|danger|neutral">`

```tsx
import { Button, Card, Badge } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/InstallationDetailPage.tsx
git commit -m "feat(ds-tier-1): InstallationDetailPage token + component geçişi"
```

---

### Task 4: PeriodDetailPage

**Files:**
- Modify: `apps/web/src/pages/PeriodDetailPage.tsx`

- [ ] **Step 1: Dosyayı oku**

`apps/web/src/pages/PeriodDetailPage.tsx` dosyasını oku. (~62 hardcoded renk)

- [ ] **Step 2: Renk + radius token'larını uygula**

Tüm hardcoded değerleri token'lara çevir.

- [ ] **Step 3: Component library geçişi**

- Button'lar → `<Button>`
- Card container'lar → `<Card>`
- Durum badge'leri → `<Badge>`

```tsx
import { Button, Card, Badge } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/PeriodDetailPage.tsx
git commit -m "feat(ds-tier-1): PeriodDetailPage token + component geçişi"
```

---

### Task 5: SettingsPage

**Files:**
- Modify: `apps/web/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula**

- [ ] **Step 3: Component library geçişi**

Form alanları → `<Input>`, kaydet/iptal butonları → `<Button>`, section'lar → `<Card>`

```tsx
import { Button, Card, Input } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/SettingsPage.tsx
git commit -m "feat(ds-tier-1): SettingsPage token + component geçişi"
```

---

### Task 6: LoginPage + ProfilePage + OnboardingPage

**Files:**
- Modify: `apps/web/src/pages/LoginPage.tsx`
- Modify: `apps/web/src/pages/ProfilePage.tsx`
- Modify: `apps/web/src/pages/OnboardingPage.tsx`

- [ ] **Step 1: Üç dosyayı oku**

`LoginPage.tsx`, `ProfilePage.tsx`, `OnboardingPage.tsx` dosyalarını oku.

- [ ] **Step 2: Renk + radius token'larını uygula (3 dosya)**

Tüm hardcoded değerleri token'lara çevir. Her dosyada ayrı ayrı uygula.

- [ ] **Step 3: Component library geçişi (3 dosya)**

- Login butonu → `<Button variant="primary" size="lg">`
- Form input'ları → `<Input label=... />`
- Kart alanları → `<Card>`

```tsx
import { Button, Card, Input } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/LoginPage.tsx apps/web/src/pages/ProfilePage.tsx apps/web/src/pages/OnboardingPage.tsx
git commit -m "feat(ds-tier-1): LoginPage + ProfilePage + OnboardingPage token + component geçişi"
```

---

### Task 7: Tier 1 Final Check + Merge

**Files:** —

- [ ] **Step 1: Tüm testleri çalıştır**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx vitest run
```

Beklenen: 8 test dosyası, 32 test — hepsi geçmeli

- [ ] **Step 2: TypeScript final check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx tsc --noEmit
```

Beklenen: hata yok

- [ ] **Step 3: Master'a merge**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git checkout master
git merge feat/ds-tier-1
git branch -D feat/ds-tier-1
git push origin master
```

---

## TIER 2 — Ana Ürünler

### Task 8: Branch Oluştur (Tier 2)

- [ ] **Step 1:**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git checkout master && git checkout -b feat/ds-tier-2
```

---

### Task 9: CbamPage + CbamReportPage

**Files:**
- Modify: `apps/web/src/pages/CbamPage.tsx`
- Modify: `apps/web/src/pages/CbamReportPage.tsx`

- [ ] **Step 1: İki dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (2 dosya)**

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Badge } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/CbamPage.tsx apps/web/src/pages/CbamReportPage.tsx
git commit -m "feat(ds-tier-2): CbamPage + CbamReportPage token + component geçişi"
```

---

### Task 10: CbamWizardPage

**Files:**
- Modify: `apps/web/src/pages/CbamWizardPage.tsx`

- [ ] **Step 1: Dosyayı oku**

Multi-step wizard sayfası. Step indicator'lar, form alanları ve aksiyon butonlarına odaklan.

- [ ] **Step 2: Renk + radius token'larını uygula**

Step indicator renkleri (aktif/pasif adım) de token'a çevrilmeli.

- [ ] **Step 3: Component library geçişi**

- İleri/Geri/Kaydet butonları → `<Button>`
- Form alanları → `<Input>`
- Section card'lar → `<Card>`

```tsx
import { Button, Card, Input } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/CbamWizardPage.tsx
git commit -m "feat(ds-tier-2): CbamWizardPage token + component geçişi"
```

---

### Task 11: CbamFacilityPage + CbamProductPage

**Files:**
- Modify: `apps/web/src/pages/CbamFacilityPage.tsx`
- Modify: `apps/web/src/pages/CbamProductPage.tsx`

- [ ] **Step 1: İki dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (2 dosya)**

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Badge, Input } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/CbamFacilityPage.tsx apps/web/src/pages/CbamProductPage.tsx
git commit -m "feat(ds-tier-2): CbamFacilityPage + CbamProductPage token + component geçişi"
```

---

### Task 12: CfePage + CfeMatchingPage

**Files:**
- Modify: `apps/web/src/pages/CfePage.tsx`
- Modify: `apps/web/src/pages/CfeMatchingPage.tsx`

- [ ] **Step 1: İki dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (2 dosya)**

Recharts renk prop'larına dokunma.

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Badge, StatCard } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/CfePage.tsx apps/web/src/pages/CfeMatchingPage.tsx
git commit -m "feat(ds-tier-2): CfePage + CfeMatchingPage token + component geçişi"
```

---

### Task 13: CfeDataEntryPage + CfeCertificatesPage + CfeFacilitiesPage + CfeGreenAssetsPage

**Files:**
- Modify: `apps/web/src/pages/CfeDataEntryPage.tsx`
- Modify: `apps/web/src/pages/CfeCertificatesPage.tsx`
- Modify: `apps/web/src/pages/CfeFacilitiesPage.tsx`
- Modify: `apps/web/src/pages/CfeGreenAssetsPage.tsx`

- [ ] **Step 1: Dört dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (4 dosya)**

- [ ] **Step 3: Component library geçişi (4 dosya)**

```tsx
import { Button, Card, Badge, Input } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/CfeDataEntryPage.tsx apps/web/src/pages/CfeCertificatesPage.tsx apps/web/src/pages/CfeFacilitiesPage.tsx apps/web/src/pages/CfeGreenAssetsPage.tsx
git commit -m "feat(ds-tier-2): CFE veri sayfaları token + component geçişi"
```

---

### Task 14: GhgProtocolPage + Iso14064Page + GecPage

**Files:**
- Modify: `apps/web/src/pages/GhgProtocolPage.tsx`
- Modify: `apps/web/src/pages/Iso14064Page.tsx`
- Modify: `apps/web/src/pages/GecPage.tsx`

- [ ] **Step 1: Üç dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (3 dosya)**

Recharts varsa renk prop'larına dokunma.

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Badge, StatCard } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/GhgProtocolPage.tsx apps/web/src/pages/Iso14064Page.tsx apps/web/src/pages/GecPage.tsx
git commit -m "feat(ds-tier-2): GhgProtocol + Iso14064 + Gec sayfaları token + component geçişi"
```

---

### Task 15: CsrdReportPage + CdpReportPage

**Files:**
- Modify: `apps/web/src/pages/CsrdReportPage.tsx`
- Modify: `apps/web/src/pages/CdpReportPage.tsx`

- [ ] **Step 1: İki dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (2 dosya)**

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Badge } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/CsrdReportPage.tsx apps/web/src/pages/CdpReportPage.tsx
git commit -m "feat(ds-tier-2): CsrdReportPage + CdpReportPage token + component geçişi"
```

---

### Task 16: Tier 2 Final Check + Merge

- [ ] **Step 1: Testleri çalıştır**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx vitest run
```

Beklenen: tüm testler geçmeli

- [ ] **Step 2: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 3: Merge**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git checkout master && git merge feat/ds-tier-2
git branch -D feat/ds-tier-2 && git push origin master
```

---

## TIER 3 — İkincil Özellikler

### Task 17: Branch Oluştur (Tier 3)

- [ ] **Step 1:**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git checkout master && git checkout -b feat/ds-tier-3
```

---

### Task 18: BenchmarkPage + ComparisonPage + EmissionTargetsPage

**Files:**
- Modify: `apps/web/src/pages/BenchmarkPage.tsx`
- Modify: `apps/web/src/pages/ComparisonPage.tsx`
- Modify: `apps/web/src/pages/EmissionTargetsPage.tsx`

- [ ] **Step 1: Üç dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (3 dosya)**

Recharts renk prop'larına dokunma.

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Badge, StatCard } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/BenchmarkPage.tsx apps/web/src/pages/ComparisonPage.tsx apps/web/src/pages/EmissionTargetsPage.tsx
git commit -m "feat(ds-tier-3): Benchmark + Comparison + EmissionTargets token + component geçişi"
```

---

### Task 19: CarbonPricePage + ImportWizardPage

**Files:**
- Modify: `apps/web/src/pages/CarbonPricePage.tsx`
- Modify: `apps/web/src/pages/ImportWizardPage.tsx`

- [ ] **Step 1: İki dosyayı oku**

ImportWizardPage çok adımlı bir wizard — step indicator'lar ve form alanları token'a geçer, layout korunur.

- [ ] **Step 2: Renk + radius token'larını uygula (2 dosya)**

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Input, Badge } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/CarbonPricePage.tsx apps/web/src/pages/ImportWizardPage.tsx
git commit -m "feat(ds-tier-3): CarbonPrice + ImportWizard token + component geçişi"
```

---

### Task 20: EfDataPage + EfZonesPage + EfCoveragePage + EfApiPage

**Files:**
- Modify: `apps/web/src/pages/EfDataPage.tsx`
- Modify: `apps/web/src/pages/EfZonesPage.tsx`
- Modify: `apps/web/src/pages/EfCoveragePage.tsx`
- Modify: `apps/web/src/pages/EfApiPage.tsx`

- [ ] **Step 1: Dört dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (4 dosya)**

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Badge } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/EfDataPage.tsx apps/web/src/pages/EfZonesPage.tsx apps/web/src/pages/EfCoveragePage.tsx apps/web/src/pages/EfApiPage.tsx
git commit -m "feat(ds-tier-3): EF sayfaları token + component geçişi"
```

---

### Task 21: IntegrationsPage + ApiPlaygroundPage

**Files:**
- Modify: `apps/web/src/pages/IntegrationsPage.tsx`
- Modify: `apps/web/src/pages/ApiPlaygroundPage.tsx`

- [ ] **Step 1: İki dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (2 dosya)**

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Badge, Input } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/IntegrationsPage.tsx apps/web/src/pages/ApiPlaygroundPage.tsx
git commit -m "feat(ds-tier-3): Integrations + ApiPlayground token + component geçişi"
```

---

### Task 22: Live Sayfaları (5 sayfa)

**Files:**
- Modify: `apps/web/src/pages/LiveForecastHubPage.tsx`
- Modify: `apps/web/src/pages/live/DamPriceChartPage.tsx`
- Modify: `apps/web/src/pages/live/GenerationChartPage.tsx`
- Modify: `apps/web/src/pages/live/CarbonIntensityPage.tsx`
- Modify: `apps/web/src/pages/live/OptimalWindowPage.tsx`

- [ ] **Step 1: Beş dosyayı oku**

Live sayfalar Recharts ağırlıklı — renk prop'larına dokunmadan sadece container/shell token'larını güncelle.

- [ ] **Step 2: Renk + radius token'larını uygula (5 dosya)**

Chart container div'leri, başlık renkleri, kart arka planları — bunları token'a çevir. `<Bar fill>`, `<Line stroke>`, `<XAxis tick>` prop'larına **dokunma**.

- [ ] **Step 3: Component library geçişi**

```tsx
// live/ sayfalar için
import { Button, Card, Badge } from "../../components/ui/index.js";
// LiveForecastHubPage için
import { Button, Card, Badge } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/LiveForecastHubPage.tsx apps/web/src/pages/live/DamPriceChartPage.tsx apps/web/src/pages/live/GenerationChartPage.tsx apps/web/src/pages/live/CarbonIntensityPage.tsx apps/web/src/pages/live/OptimalWindowPage.tsx
git commit -m "feat(ds-tier-3): Live sayfaları token + component geçişi"
```

---

### Task 23: Tier 3 Final Check + Merge

- [ ] **Step 1: Testleri çalıştır**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx vitest run
```

- [ ] **Step 2: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 3: Merge**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git checkout master && git merge feat/ds-tier-3
git branch -D feat/ds-tier-3 && git push origin master
```

---

## TIER 4 — Admin + Utility

### Task 24: Branch Oluştur (Tier 4)

- [ ] **Step 1:**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git checkout master && git checkout -b feat/ds-tier-4
```

---

### Task 25: Admin Sayfaları — Grup A

**Files:**
- Modify: `apps/web/src/pages/admin/AdminDashboardPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminUsersPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminTenantsPage.tsx`

- [ ] **Step 1: Üç dosyayı oku**

Admin sayfalar genellikle tablo + aksiyon buton pattern'i kullanır.

- [ ] **Step 2: Renk + radius token'larını uygula (3 dosya)**

- [ ] **Step 3: Component library geçişi**

```tsx
// admin/ sayfalar için
import { Button, Card, Badge, Input } from "../../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/admin/AdminDashboardPage.tsx apps/web/src/pages/admin/AdminUsersPage.tsx apps/web/src/pages/admin/AdminTenantsPage.tsx
git commit -m "feat(ds-tier-4): Admin sayfaları A grubu token + component geçişi"
```

---

### Task 26: Admin Sayfaları — Grup B

**Files:**
- Modify: `apps/web/src/pages/admin/AdminApiPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminSmtpPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminAnnouncementsPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminWebhooksPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminEfDataPage.tsx`

- [ ] **Step 1: Beş dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (5 dosya)**

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Badge, Input } from "../../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/admin/AdminApiPage.tsx apps/web/src/pages/admin/AdminSmtpPage.tsx apps/web/src/pages/admin/AdminAnnouncementsPage.tsx apps/web/src/pages/admin/AdminWebhooksPage.tsx apps/web/src/pages/admin/AdminEfDataPage.tsx
git commit -m "feat(ds-tier-4): Admin sayfaları B grubu token + component geçişi"
```

---

### Task 27: SharePage + InvitePage

**Files:**
- Modify: `apps/web/src/pages/SharePage.tsx`
- Modify: `apps/web/src/pages/InvitePage.tsx`

- [ ] **Step 1: İki dosyayı oku**

- [ ] **Step 2: Renk + radius token'larını uygula (2 dosya)**

- [ ] **Step 3: Component library geçişi**

```tsx
import { Button, Card, Input } from "../components/ui/index.js";
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/SharePage.tsx apps/web/src/pages/InvitePage.tsx
git commit -m "feat(ds-tier-4): SharePage + InvitePage token + component geçişi"
```

---

### Task 28: Tier 4 Final Check + Merge

- [ ] **Step 1: Testleri çalıştır**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx vitest run
```

Beklenen: tüm testler geçmeli

- [ ] **Step 2: TypeScript check**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web" && npx tsc --noEmit
```

- [ ] **Step 3: Merge + push**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git checkout master && git merge feat/ds-tier-4
git branch -D feat/ds-tier-4 && git push origin master
```

- [ ] **Step 4: Hardcoded renk kontrolü**

```bash
cd "C:\Users\erhan\Downloads\Claude"
grep -rn "#[0-9a-fA-F]\{6\}" apps/web/src/pages/ --include="*.tsx" | grep -v "node_modules" | grep -v "EsgPlayground" | grep -v "recharts"
```

Beklenen: sadece Recharts prop'larından kalanlar (kabul edilebilir)

---

## Self-Review Notları

**Spec coverage:**
- ✅ 48 sayfa 4 tier'a bölündü (7 + 15 + 16 + 10)
- ✅ Renk token eşlemesi plan başında tanımlandı
- ✅ Radius/shadow token eşlemesi tanımlandı
- ✅ Button, Card, Badge, Input, StatCard geçiş örnekleri verildi
- ✅ Import path farkı (pages/ vs pages/admin/ vs pages/live/) belirtildi
- ✅ Recharts kapsam dışı açıkça belirtildi
- ✅ Her tier için branch + merge döngüsü var
- ✅ Her tier sonunda vitest + tsc kontrolü var
- ✅ Dark mode: token kullanımı otomatik çözer, ek adım yok
