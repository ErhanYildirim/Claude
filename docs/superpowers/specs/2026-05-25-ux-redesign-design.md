# Voltfox Platform — UX Redesign & Design System

**Tarih:** 2026-05-25  
**Kapsam:** Design system kurulumu + AppShell yenileme (Foundation-First)  
**Yaklaşım:** Token altyapısı → Component library → AppShell → Sayfalar

---

## 1. Bağlam

Voltfox platformu 50 sayfa, ~React 18 + Vite + TypeScript içeriyor. Mevcut durumda:
- Tüm stiller inline `style` nesneleriyle yazılmış, merkezi token sistemi yok
- Resmi bir component library mevcut değil
- Emoji icon'lar sidebar'da kullanılıyor
- Geist font ailesi var; dark/light mode `ThemeContext.tsx` üzerinden çalışıyor
- Renk değerleri `index.html` içindeki `<style>` bloğunda CSS variable olarak tanımlı

---

## 2. Tasarım Kararları

| Karar | Seçim | Gerekçe |
|---|---|---|
| Estetik yön | Modern Teal Dark | Mevcut #00c87a kimliğini koruyarak Linear/Vercel estetiğine geçiş |
| Tipografi | Outfit (tek font, 300–800) | Friendly-professional, tek font = kurulum basit, tutarlılık yüksek |
| CSS yaklaşımı | CSS variables + tokens.css | Mevcut altyapıyı genişletir, sıfırdan yeniden yazma gerektirmez |
| Icon sistemi | Lucide React | Temiz SVG, tree-shakeable, emoji'lerin yerini alır |
| Bileşen mimarisi | `components/ui/` klasörü | Merkezi, her sayfa buradan import eder |

---

## 3. Design Tokens

**Dosya:** `apps/web/src/styles/tokens.css`

### Renk Paleti — Dark Theme

```css
:root[data-theme="dark"] {
  /* Backgrounds */
  --bg-base:     #060e0b;
  --bg-surface:  #0d1f18;
  --bg-elevated: #132a1f;
  --bg-subtle:   #1c3a2c;

  /* Accent */
  --accent:        #00c87a;
  --accent-bright: #00e87a;
  --accent-muted:  #008854;

  /* Text */
  --text-primary:   #e2f0ea;
  --text-secondary: #7dbfa0;
  --text-muted:     #4d8a6a;

  /* Border */
  --border:        rgba(255,255,255,0.09);
  --border-accent: rgba(0,200,122,0.12);

  /* Semantic */
  --success: #22c55e;
  --warning: #f59e0b;
  --danger:  #ef4444;
  --info:    #3b82f6;
}
```

### Renk Paleti — Light Theme

```css
:root[data-theme="light"] {
  --bg-base:     #f0f7f4;
  --bg-surface:  #ffffff;
  --bg-elevated: #f5faf7;
  --bg-subtle:   #e8f3ed;

  --accent:        #00a866;
  --accent-bright: #00c87a;
  --accent-muted:  #007a4a;

  --text-primary:   #0a1f1a;
  --text-secondary: #2d6b52;
  --text-muted:     #6b9e88;

  --border:        rgba(0,0,0,0.08);
  --border-accent: rgba(0,168,102,0.15);

  --success: #16a34a;
  --warning: #d97706;
  --danger:  #dc2626;
  --info:    #2563eb;
}
```

### Tipografi

```css
--font-sans: 'Outfit', system-ui, sans-serif;
--font-mono: 'DM Mono', 'Courier New', monospace;

--text-xs:   11px;  /* label, badge */
--text-sm:   13px;  /* caption, metadata */
--text-base: 14px;  /* body copy */
--text-md:   16px;  /* UI metin */
--text-lg:   18px;  /* section başlık */
--text-xl:   22px;  /* sayfa başlığı */
--text-2xl:  28px;  /* hero metric */
```

### Spacing (4px base)

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-6:  24px;
--space-8:  32px;
--space-12: 48px;
--space-16: 64px;
```

### Border Radius & Shadow

```css
--radius-sm:   4px;
--radius-md:   8px;
--radius-lg:   12px;
--radius-pill: 9999px;

--shadow-sm:   0 1px 2px rgba(0,0,0,0.30);
--shadow-md:   0 4px 12px rgba(0,0,0,0.40);
--shadow-glow: 0 8px 24px rgba(0,0,0,0.50), 0 0 0 1px rgba(0,200,122,0.09);
```

---

## 4. Component Library

**Klasör:** `apps/web/src/components/ui/`

Her bileşen:
- Props aracılığıyla varyant alır (`variant`, `size`)
- Inline style yerine CSS variables kullanır
- TypeScript ile tam tiplenmiş
- Lucide icon'larla uyumlu

### Bileşen Listesi

| Dosya | Açıklama | Varyantlar |
|---|---|---|
| `Button.tsx` | Aksiyon butonu | primary / secondary / ghost / danger; sm / default / lg |
| `Badge.tsx` | Durum etiketi | success / warning / danger / accent / neutral |
| `Card.tsx` | İçerik konteyneri | base / accent / flat |
| `Input.tsx` | Form girdi alanı | default / focused / error; label + error mesajı prop'u |
| `StatCard.tsx` | KPI metrik kartı | value, unit, label, delta (up/down), progress (opsiyonel) |
| `Tabs.tsx` | Sayfa içi tab navigasyon | items array, activeTab, onChange |
| `DataTable.tsx` | Veri tablosu | columns, data, onRowClick |

### Button API Örneği

```tsx
<Button variant="primary" size="lg" onClick={handleSave}>
  Kaydet
</Button>

<Button variant="ghost" size="sm">
  İptal
</Button>
```

### StatCard API Örneği

```tsx
<StatCard
  label="Toplam Emisyon"
  value="24,831"
  unit="tCO₂e"
  delta={{ value: -12.4, label: "önceki çeyrek" }}
  progress={{ value: 74, total: 100 }}
/>
```

---

## 5. AppShell & Navigation

**Dosyalar:** `AppShell.tsx`, `TopBar.tsx`

### Sidebar Değişiklikleri

- **Icon sistemi:** `lucide-react` — tüm emoji'ler kaldırılır
- **Yapı:**
  - Logo alanı: gradient logomark + "Voltfox" + "ESG Platform" alt etiketi
  - Nav section'lar: `Ürünler`, `Raporlar`, `Araçlar` section label'larıyla gruplandırılmış
  - Accordion gruplar: `CFE Matching`, `CBAM Emisyonları`, `EF Data Service` alt menüleri
  - Active indicator: sol kenarda 3px yeşil çizgi + `--bg-elevated` arka plan
  - `LIVE` badge: Live Forecast nav öğesinde
- **Footer:** Avatar (isim baş harfi) + kullanıcı adı + rol + chevron

### Sidebar Nav Icon Eşlemesi

| Sayfa | Lucide Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| 24/7 CFE Matching | `Zap` |
| CBAM Emisyonları | `Factory` |
| GEC Scope 1 | `Leaf` |
| EF Data Service | `Database` |
| Live Forecast | `Radio` |
| ESG Playground | `GitBranch` |
| Raporlar | `FileText` |
| CSRD | `ShieldCheck` |
| Karbon Fiyatları | `TrendingUp` |
| Araçlar | `Sliders` |
| Ayarlar | `Settings` |

### TopBar Değişiklikleri

- **Sol:** Breadcrumb (parent / current page)
- **Orta:** `⌘K` global arama kutusu (mevcut `GlobalSearch.tsx` korunur)
- **Sağ:** Bildirim (dot badge) + Yardım + Tema toggle (Lucide icon butonları)

---

## 6. Uygulama Fazları

### Faz 1 — Token & Stil Altyapısı (2-3 gün)

1. `apps/web/src/styles/tokens.css` oluştur — tüm CSS variables
2. `apps/web/src/styles/global.css` oluştur — reset, Outfit import, body defaults
3. `apps/web/index.html` içindeki inline `<style>` bloğunu kaldır
4. `apps/web/src/main.tsx`'e yeni CSS dosyalarını import et
5. Mevcut `ThemeContext.tsx`'i token isimleriyle uyumlu hale getir

**Kapsam dışı:** Herhangi bir sayfa veya bileşen değişikliği

### Faz 2 — Component Library (4-5 gün)

1. `lucide-react` paketini ekle
2. `apps/web/src/components/ui/` klasörünü oluştur
3. Sırayla yaz: `Button` → `Badge` → `Card` → `Input` → `StatCard` → `Tabs` → `DataTable`
4. Her bileşeni geliştirirken mevcut sayfalardan inline style örüntülerini incele

**Kapsam dışı:** Mevcut sayfaları güncelleme (Faz 4'te yapılır)

### Faz 3 — AppShell & Navigation (2-3 gün)

1. `AppShell.tsx` yeniden yaz — yeni sidebar tasarımı, section label'lar, accordion, active indicator
2. `TopBar.tsx` güncelle — breadcrumb, search kutusu, Lucide icon butonlar
3. Tüm emoji icon referanslarını `lucide-react` ile değiştir
4. Light/dark mode token geçişini test et

### Faz 4 — Sayfa Güncellemeleri (ongoing)

Öncelik sırası:
1. `DashboardPage.tsx` — en çok görülen sayfa
2. `CbamWizardPage.tsx` — kullanıcı yoğunluğu yüksek
3. `InstallationDetailPage.tsx`
4. `GecPage.tsx`
5. `CfePage.tsx` ve alt sayfalar
6. `SettingsPage.tsx`
7. Diğer sayfalar (EF Data, Live Forecast, Reports, Tools)

Her sayfa güncellemesi bağımsız olarak yapılabilir ve ayrı PR olarak gönderilebilir.

---

## 7. Kapsam Dışı

- Responsive / mobile layout (ayrı bir kapsam)
- ESG Playground (React Flow) bileşen değişikliği
- Backend / API değişiklikleri
- Yeni özellik eklenmesi
