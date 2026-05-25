# Voltfox Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Foundation-First design system kurulumu — CSS token altyapısı, 7-bileşen component library ve AppShell/TopBar yenilemesi.

**Architecture:** Önce `tokens.css` + `global.css` ile merkezi stil altyapısı kurulur, ThemeContext sadeleştirilir. Ardından `components/ui/` klasörüne 7 temel bileşen yazılır. Son olarak AppShell ve TopBar yeni token'ları ve Lucide icon'ları kullanacak şekilde yeniden yazılır. Mevcut sayfalar bu plan kapsamında değiştirilmez — backward compat token alias'ları sayesinde çalışmaya devam eder.

**Tech Stack:** React 18, TypeScript, Vite, vitest + @testing-library/react (yeni), lucide-react (yeni), Outfit (Google Fonts, Geist'ın yerini alır)

---

## Kapsam Dışı

- Mevcut sayfaların güncellenmesi (Faz 4 — ayrı plan)
- ESG Playground (React Flow) değişikliği
- Responsive/mobile layout
- Backend değişikliği

---

## Dosya Haritası

### Oluşturulacak
| Dosya | Sorumluluk |
|---|---|
| `apps/web/src/styles/tokens.css` | Tüm CSS değişkenleri (renk, tipografi, spacing, radius, shadow) |
| `apps/web/src/styles/global.css` | Reset, Outfit font, body defaults, scrollbar, skeleton |
| `apps/web/src/test/setup.ts` | Vitest + @testing-library/jest-dom init |
| `apps/web/src/components/ui/Button.tsx` | Aksiyon butonu, 4 varyant, 3 boyut |
| `apps/web/src/components/ui/Badge.tsx` | Durum etiketi, 5 varyant |
| `apps/web/src/components/ui/Card.tsx` | İçerik konteyneri, 3 varyant |
| `apps/web/src/components/ui/Input.tsx` | Form girdi alanı, label + error prop |
| `apps/web/src/components/ui/StatCard.tsx` | KPI metrik kartı, delta + progress |
| `apps/web/src/components/ui/Tabs.tsx` | Tab navigasyon, items array |
| `apps/web/src/components/ui/DataTable.tsx` | Veri tablosu, columns + data |
| `apps/web/src/components/ui/index.ts` | Barrel export |
| `apps/web/src/components/ui/__tests__/Button.test.tsx` | Button render testleri |
| `apps/web/src/components/ui/__tests__/Badge.test.tsx` | Badge render testleri |
| `apps/web/src/components/ui/__tests__/Card.test.tsx` | Card render testleri |
| `apps/web/src/components/ui/__tests__/Input.test.tsx` | Input render testleri |
| `apps/web/src/components/ui/__tests__/StatCard.test.tsx` | StatCard render testleri |
| `apps/web/src/components/ui/__tests__/Tabs.test.tsx` | Tabs interaction testleri |
| `apps/web/src/components/ui/__tests__/DataTable.test.tsx` | DataTable render testleri |

### Değiştirilecek
| Dosya | Değişiklik |
|---|---|
| `apps/web/package.json` | vitest, @testing-library/react, @testing-library/jest-dom, jsdom, lucide-react ekle |
| `apps/web/vite.config.ts` | vitest test bloğu ekle |
| `apps/web/index.html` | Inline `<style>` → kaldır; Geist → Outfit font; anti-flash script ekle |
| `apps/web/src/main.tsx` | tokens.css + global.css import et |
| `apps/web/src/contexts/ThemeContext.tsx` | applyTheme() sadeleştir — sadece data-theme attribute set et |
| `apps/web/src/components/AppShell.tsx` | Tam yeniden yazım — Lucide icons, yeni token'lar, section label'lar |
| `apps/web/src/components/TopBar.tsx` | Breadcrumb + Lucide icons + yeni token'lar |

---

## FAZ 1 — Token & Stil Altyapısı

---

### Task 1: Test Altyapısı Kurulumu

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/src/test/setup.ts`

- [ ] **Step 1: Paketleri yükle**

```bash
cd apps/web
npm install lucide-react
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

- [ ] **Step 2: vite.config.ts'e test bloğu ekle**

`apps/web/vite.config.ts` dosyasını şu hale getir:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
  },
});
```

- [ ] **Step 3: tsconfig'e vitest globals ekle**

`apps/web/tsconfig.json` dosyasında `compilerOptions.types` dizisine `"vitest/globals"` ekle. Dosya yoksa `apps/web/tsconfig.app.json`'u kontrol et ve `types` dizisini ekle:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

- [ ] **Step 4: Test setup dosyasını oluştur**

`apps/web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: package.json'a test script ekle**

`apps/web/package.json` scripts bölümüne ekle:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Kurulumu doğrula**

```bash
cd apps/web
npm run test
```

Beklenen çıktı: `No test files found` (henüz test yok, ama hata yok)

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/vite.config.ts apps/web/src/test/setup.ts
git commit -m "feat(design-system): test altyapısı kurulumu — vitest + testing-library"
```

---

### Task 2: tokens.css Oluşturma

**Files:**
- Create: `apps/web/src/styles/tokens.css`

- [ ] **Step 1: Dizini oluştur**

```bash
mkdir -p apps/web/src/styles
```

- [ ] **Step 2: tokens.css dosyasını oluştur**

`apps/web/src/styles/tokens.css`:

```css
/* ═══════════════════════════════════════════════════════════════
   Voltfox Design Tokens
   Modern Teal Dark sistem — Outfit tipografisi, 4px spacing grid
   ═══════════════════════════════════════════════════════════════ */

/* ── Light theme (default) ─────────────────────────────────── */
:root,
[data-theme="light"] {
  /* Backgrounds */
  --bg-base:     #f0f7f4;
  --bg-surface:  #ffffff;
  --bg-elevated: #f5faf7;
  --bg-subtle:   #e8f3ed;

  /* Accent */
  --accent:        #00a866;
  --accent-bright: #00c87a;
  --accent-muted:  #007a4a;
  --accent-bg:     rgba(0,168,102,0.10);

  /* Text */
  --text-primary:   #0a1f1a;
  --text-secondary: #2d6b52;
  --text-muted:     #6b9e88;

  /* Border */
  --border:        rgba(0,0,0,0.08);
  --border-accent: rgba(0,168,102,0.15);

  /* Semantic */
  --success: #16a34a;
  --warning: #d97706;
  --danger:  #dc2626;
  --info:    #2563eb;

  /* Shadow */
  --shadow-sm:   0 1px 2px rgba(0,0,0,0.06);
  --shadow-md:   0 4px 12px rgba(0,0,0,0.10);
  --shadow-glow: 0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,168,102,0.12);

  /* Radius */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-pill: 9999px;

  /* Spacing (4px base) */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;
  --space-16: 64px;

  /* Typography */
  --font-sans: 'Outfit', system-ui, sans-serif;
  --font-mono: 'DM Mono', 'Courier New', monospace;
  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 14px;
  --text-md:   16px;
  --text-lg:   18px;
  --text-xl:   22px;
  --text-2xl:  28px;

  /* ── Backward-compat aliases (mevcut sayfalar için) ── */
  --bg:           var(--bg-base);
  --bg-card:      var(--bg-surface);
  --bg-topbar:    var(--bg-surface);
  --bg-sidebar:   #0a1f1a;
  --text:         var(--text-primary);
  --text-subtle:  var(--text-muted);
  --border-light: var(--bg-elevated);
  --accent-dark:  var(--accent-muted);
  --accent-light: var(--accent-bg);
  --panel:        var(--bg-surface);
  --muted:        var(--text-secondary);
  --accent-2:     var(--accent-muted);
  --warn:         var(--warning);
  --radius-card:  var(--radius-lg);
  --radius:       var(--radius-lg);
}

/* ── Dark theme ────────────────────────────────────────────── */
[data-theme="dark"] {
  /* Backgrounds */
  --bg-base:     #060e0b;
  --bg-surface:  #0d1f18;
  --bg-elevated: #132a1f;
  --bg-subtle:   #1c3a2c;

  /* Accent */
  --accent:        #00c87a;
  --accent-bright: #00e87a;
  --accent-muted:  #008854;
  --accent-bg:     rgba(0,200,122,0.10);

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

  /* Shadow */
  --shadow-sm:   0 1px 2px rgba(0,0,0,0.30);
  --shadow-md:   0 4px 12px rgba(0,0,0,0.40);
  --shadow-glow: 0 8px 24px rgba(0,0,0,0.50), 0 0 0 1px rgba(0,200,122,0.09);

  /* Radius — dark tema aynı değerleri kullanır */

  /* ── Backward-compat aliases ── */
  --bg:           var(--bg-base);
  --bg-card:      var(--bg-surface);
  --bg-topbar:    var(--bg-surface);
  --bg-sidebar:   #080f0d;
  --text:         var(--text-primary);
  --text-subtle:  var(--text-muted);
  --border-light: var(--bg-elevated);
  --accent-dark:  var(--accent-bright);
  --accent-light: var(--accent-bg);
  --panel:        var(--bg-surface);
  --muted:        var(--text-secondary);
  --accent-2:     var(--accent-bright);
  --warn:         var(--warning);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/styles/tokens.css
git commit -m "feat(design-system): tokens.css — renk, tipografi, spacing, radius token'ları"
```

---

### Task 3: global.css Oluşturma

**Files:**
- Create: `apps/web/src/styles/global.css`

- [ ] **Step 1: global.css dosyasını oluştur**

`apps/web/src/styles/global.css`:

```css
/* ═══════════════════════════════════════════════════════════════
   Voltfox Global Styles
   ═══════════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  background: var(--bg-base);
  color: var(--text-primary);
  line-height: 1.55;
  font-size: var(--text-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code, pre, kbd {
  font-family: var(--font-mono);
}

input, select, button, textarea {
  font-family: inherit;
}

a {
  color: var(--accent);
  text-decoration: none;
}
a:hover {
  color: var(--accent-bright);
}

/* Form defaults */
input[type="number"],
input[type="text"],
input[type="email"],
input[type="password"],
input[type="url"],
select,
textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: 500;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

/* Select arrow */
select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234d8a6a' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 32px;
}

/* Scrollbar */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: var(--radius-pill); }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* Focus ring */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Skeleton loader */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}

.skeleton {
  background: var(--bg-subtle);
  border-radius: var(--radius-md);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

#root {
  min-height: 100vh;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/styles/global.css
git commit -m "feat(design-system): global.css — reset, Outfit font, form defaults"
```

---

### Task 4: index.html + main.tsx Güncelleme

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: index.html'i güncelle**

`apps/web/index.html` dosyasını şu hale getir — inline `<style>` bloğunu kaldır, Geist fontunu kaldır, anti-flash script ekle:

```html
<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voltfox — Emisyon Yönetim Platformu</title>
    <script>
      (function() {
        var saved = localStorage.getItem('vf-theme');
        var preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', saved || preferred);
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: main.tsx'e CSS import'larını ekle**

`apps/web/src/main.tsx` dosyasını şu hale getir:

```tsx
import "./styles/tokens.css";
import "./styles/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { ThemeProvider } from "./contexts/ThemeContext.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
```

- [ ] **Step 3: Dev sunucusunu başlat ve görsel doğrula**

```bash
cd apps/web
npm run dev
```

Tarayıcıda `http://localhost:5173` aç. Kontrol et:
- Sayfa yükleniyor (hata yok)
- Font değişti (Outfit görünüyor — daha yuvarlak harfler)
- Tema toggle çalışıyor
- Dark/light geçişi sorunsuz (flash yok)

- [ ] **Step 4: Commit**

```bash
git add apps/web/index.html apps/web/src/main.tsx
git commit -m "feat(design-system): index.html + main.tsx — inline stil kaldırıldı, token CSS import edildi"
```

---

### Task 5: ThemeContext Sadeleştirme

**Files:**
- Modify: `apps/web/src/contexts/ThemeContext.tsx`

- [ ] **Step 1: ThemeContext.tsx'i yeniden yaz**

Mevcut `applyTheme()` fonksiyonu 20+ CSS var set ediyor. Artık tokens.css `[data-theme]` CSS selector'ları ile bunu hallediyor. Sadece attribute set etmek yeterli:

`apps/web/src/contexts/ThemeContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "light", toggle: () => {} });

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("vf-theme") as Theme | null;
    return saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("vf-theme", theme);
  }, [theme]);

  function toggle() {
    setTheme(t => (t === "light" ? "dark" : "light"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: Dev sunucusunda tema geçişini test et**

```bash
npm run dev
```

Tarayıcıda tema toggle butonuna bas. Dark ↔ Light geçişinin hâlâ çalıştığını doğrula.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/contexts/ThemeContext.tsx
git commit -m "refactor(design-system): ThemeContext — JS CSS var injection → data-theme attribute"
```

---

## FAZ 2 — Component Library

---

### Task 6: Button Bileşeni

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/components/ui/__tests__/Button.test.tsx`

- [ ] **Step 1: Failing testi yaz**

`apps/web/src/components/ui/__tests__/Button.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Kaydet</Button>);
    expect(screen.getByText("Kaydet")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Tıkla</Button>);
    fireEvent.click(screen.getByText("Tıkla"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Tıkla</Button>);
    fireEvent.click(screen.getByText("Tıkla"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies variant class", () => {
    const { container } = render(<Button variant="danger">Sil</Button>);
    expect(container.firstChild).toHaveAttribute("data-variant", "danger");
  });
});
```

- [ ] **Step 2: Testi çalıştır — fail bekleniyor**

```bash
cd apps/web && npm run test -- Button
```

Beklenen: `Cannot find module '../Button'`

- [ ] **Step 3: Button.tsx'i yaz**

`apps/web/src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  border: "none",
  borderRadius: "var(--radius-md)",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  cursor: "pointer",
  transition: "opacity 0.15s, background 0.15s",
  whiteSpace: "nowrap",
};

const SIZE_STYLES: Record<Size, React.CSSProperties> = {
  sm: { padding: "5px 10px", fontSize: "var(--text-xs)" },
  md: { padding: "8px 16px", fontSize: "var(--text-sm)" },
  lg: { padding: "11px 22px", fontSize: "var(--text-md)", fontWeight: 600 },
};

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "var(--bg-base)",
  },
  secondary: {
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
  },
  danger: {
    background: "rgba(239,68,68,0.10)",
    color: "var(--danger)",
    border: "1px solid rgba(239,68,68,0.25)",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  disabled,
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      data-variant={variant}
      disabled={disabled}
      style={{
        ...BASE,
        ...SIZE_STYLES[size],
        ...VARIANT_STYLES[variant],
        ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Testi çalıştır — pass bekleniyor**

```bash
npm run test -- Button
```

Beklenen: `4 tests passed`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Button.tsx apps/web/src/components/ui/__tests__/Button.test.tsx
git commit -m "feat(ui): Button bileşeni — 4 varyant, 3 boyut, disabled state"
```

---

### Task 7: Badge Bileşeni

**Files:**
- Create: `apps/web/src/components/ui/Badge.tsx`
- Create: `apps/web/src/components/ui/__tests__/Badge.test.tsx`

- [ ] **Step 1: Failing testi yaz**

`apps/web/src/components/ui/__tests__/Badge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Badge } from "../Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Aktif</Badge>);
    expect(screen.getByText("Aktif")).toBeInTheDocument();
  });

  it("applies variant attribute", () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    expect(container.firstChild).toHaveAttribute("data-variant", "success");
  });

  it("defaults to neutral variant", () => {
    const { container } = render(<Badge>Taslak</Badge>);
    expect(container.firstChild).toHaveAttribute("data-variant", "neutral");
  });
});
```

- [ ] **Step 2: Testi çalıştır — fail bekleniyor**

```bash
npm run test -- Badge
```

- [ ] **Step 3: Badge.tsx'i yaz**

`apps/web/src/components/ui/Badge.tsx`:

```tsx
import type { ReactNode } from "react";

type Variant = "success" | "warning" | "danger" | "accent" | "neutral";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  style?: React.CSSProperties;
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  success: { background: "rgba(34,197,94,0.12)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.25)" },
  warning: { background: "rgba(245,158,11,0.12)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.25)" },
  danger:  { background: "rgba(239,68,68,0.12)",  color: "var(--danger)",  border: "1px solid rgba(239,68,68,0.25)"  },
  accent:  { background: "var(--accent-bg)",       color: "var(--accent)",  border: "1px solid var(--border-accent)"  },
  neutral: { background: "var(--border)",          color: "var(--text-secondary)", border: "1px solid var(--border)" },
};

export function Badge({ variant = "neutral", children, style }: BadgeProps) {
  return (
    <span
      data-variant={variant}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 9px",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        letterSpacing: "0.3px",
        fontFamily: "var(--font-sans)",
        ...VARIANT_STYLES[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Testi çalıştır — pass bekleniyor**

```bash
npm run test -- Badge
```

Beklenen: `3 tests passed`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Badge.tsx apps/web/src/components/ui/__tests__/Badge.test.tsx
git commit -m "feat(ui): Badge bileşeni — 5 semantik varyant"
```

---

### Task 8: Card Bileşeni

**Files:**
- Create: `apps/web/src/components/ui/Card.tsx`
- Create: `apps/web/src/components/ui/__tests__/Card.test.tsx`

- [ ] **Step 1: Failing testi yaz**

`apps/web/src/components/ui/__tests__/Card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Card } from "../Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>İçerik</Card>);
    expect(screen.getByText("İçerik")).toBeInTheDocument();
  });

  it("applies variant attribute", () => {
    const { container } = render(<Card variant="accent">İçerik</Card>);
    expect(container.firstChild).toHaveAttribute("data-variant", "accent");
  });

  it("passes className", () => {
    const { container } = render(<Card className="custom">İçerik</Card>);
    expect(container.firstChild).toHaveClass("custom");
  });
});
```

- [ ] **Step 2: Testi çalıştır — fail bekleniyor**

```bash
npm run test -- Card
```

- [ ] **Step 3: Card.tsx'i yaz**

`apps/web/src/components/ui/Card.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from "react";

type Variant = "base" | "accent" | "flat";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  base: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-4)",
  },
  accent: {
    background: "linear-gradient(135deg, var(--accent-bg), transparent)",
    border: "1px solid var(--border-accent)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-4)",
  },
  flat: {
    background: "var(--bg-elevated)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-3)",
  },
};

export function Card({ variant = "base", style, children, ...props }: CardProps) {
  return (
    <div
      data-variant={variant}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır — pass bekleniyor**

```bash
npm run test -- Card
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Card.tsx apps/web/src/components/ui/__tests__/Card.test.tsx
git commit -m "feat(ui): Card bileşeni — base, accent, flat varyantlar"
```

---

### Task 9: Input Bileşeni

**Files:**
- Create: `apps/web/src/components/ui/Input.tsx`
- Create: `apps/web/src/components/ui/__tests__/Input.test.tsx`

- [ ] **Step 1: Failing testi yaz**

`apps/web/src/components/ui/__tests__/Input.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders with placeholder", () => {
    render(<Input placeholder="Ara..." />);
    expect(screen.getByPlaceholderText("Ara...")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<Input label="Tesis Adı" />);
    expect(screen.getByText("Tesis Adı")).toBeInTheDocument();
  });

  it("renders error message when provided", () => {
    render(<Input error="Bu alan zorunludur" />);
    expect(screen.getByText("Bu alan zorunludur")).toBeInTheDocument();
  });

  it("passes id from label to input", () => {
    render(<Input label="Email" id="email-input" />);
    const label = screen.getByText("Email");
    expect(label).toHaveAttribute("for", "email-input");
  });
});
```

- [ ] **Step 2: Testi çalıştır — fail bekleniyor**

```bash
npm run test -- Input
```

- [ ] **Step 3: Input.tsx'i yaz**

`apps/web/src/components/ui/Input.tsx`:

```tsx
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, style, ...props }: InputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            fontFamily: "var(--font-sans)",
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        style={{
          background: "var(--bg-surface)",
          border: `1.5px solid ${error ? "var(--danger)" : "var(--border)"}`,
          borderRadius: "var(--radius-md)",
          padding: "9px var(--space-3)",
          color: "var(--text-primary)",
          fontSize: "var(--text-sm)",
          fontFamily: "var(--font-sans)",
          outline: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          width: "100%",
          ...style,
        }}
        {...props}
      />
      {error && (
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--danger)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır — pass bekleniyor**

```bash
npm run test -- Input
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Input.tsx apps/web/src/components/ui/__tests__/Input.test.tsx
git commit -m "feat(ui): Input bileşeni — label, error state, accessible htmlFor"
```

---

### Task 10: StatCard Bileşeni

**Files:**
- Create: `apps/web/src/components/ui/StatCard.tsx`
- Create: `apps/web/src/components/ui/__tests__/StatCard.test.tsx`

- [ ] **Step 1: Failing testi yaz**

`apps/web/src/components/ui/__tests__/StatCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { StatCard } from "../StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="CFE Skoru" value="87.3" unit="%" />);
    expect(screen.getByText("CFE Skoru")).toBeInTheDocument();
    expect(screen.getByText("87.3")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
  });

  it("renders delta with up direction", () => {
    render(
      <StatCard label="Emisyon" value="24,831" unit="tCO₂e"
        delta={{ value: -12.4, direction: "down", label: "önceki çeyrek" }}
      />
    );
    expect(screen.getByText(/12.4/)).toBeInTheDocument();
  });

  it("renders progress bar when progress provided", () => {
    const { container } = render(
      <StatCard label="Hedef" value="74" unit="%"
        progress={{ value: 74 }}
      />
    );
    expect(container.querySelector("[data-progress]")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Testi çalıştır — fail bekleniyor**

```bash
npm run test -- StatCard
```

- [ ] **Step 3: StatCard.tsx'i yaz**

`apps/web/src/components/ui/StatCard.tsx`:

```tsx
interface Delta {
  value: number;
  direction: "up" | "down";
  label?: string;
}

interface Progress {
  value: number;
  max?: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: Delta;
  progress?: Progress;
  variant?: "base" | "accent";
  style?: React.CSSProperties;
}

export function StatCard({ label, value, unit, delta, progress, variant = "base", style }: StatCardProps) {
  const isAccent = variant === "accent";

  return (
    <div
      style={{
        background: isAccent
          ? "linear-gradient(135deg, var(--accent-bg), transparent)"
          : "var(--bg-surface)",
        border: `1px solid ${isAccent ? "var(--border-accent)" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4) var(--space-4)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <div style={{
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: "var(--text-muted)",
        marginBottom: "var(--space-1)",
      }}>
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "5px", lineHeight: 1 }}>
        <span style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.5px",
        }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 400 }}>
            {unit}
          </span>
        )}
      </div>

      {delta && (
        <div style={{
          marginTop: "var(--space-1)",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color: delta.direction === "up" ? "var(--success)" : "var(--danger)",
        }}>
          {delta.direction === "up" ? "↑" : "↓"} {Math.abs(delta.value)}%
          {delta.label && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> {delta.label}</span>}
        </div>
      )}

      {progress && (
        <div data-progress style={{ marginTop: "var(--space-2)" }}>
          <div style={{
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-pill)",
            height: "4px",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.min(progress.value, progress.max ?? 100)}%`,
              background: "linear-gradient(90deg, var(--accent), var(--accent-bright))",
              borderRadius: "var(--radius-pill)",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır — pass bekleniyor**

```bash
npm run test -- StatCard
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/StatCard.tsx apps/web/src/components/ui/__tests__/StatCard.test.tsx
git commit -m "feat(ui): StatCard bileşeni — delta göstergesi, progress bar"
```

---

### Task 11: Tabs Bileşeni

**Files:**
- Create: `apps/web/src/components/ui/Tabs.tsx`
- Create: `apps/web/src/components/ui/__tests__/Tabs.test.tsx`

- [ ] **Step 1: Failing testi yaz**

`apps/web/src/components/ui/__tests__/Tabs.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../Tabs";

const items = [
  { key: "overview", label: "Genel Bakış" },
  { key: "emissions", label: "Emisyonlar" },
  { key: "facilities", label: "Tesisler" },
];

describe("Tabs", () => {
  it("renders all tab labels", () => {
    render(<Tabs items={items} activeKey="overview" onChange={() => {}} />);
    expect(screen.getByText("Genel Bakış")).toBeInTheDocument();
    expect(screen.getByText("Emisyonlar")).toBeInTheDocument();
    expect(screen.getByText("Tesisler")).toBeInTheDocument();
  });

  it("calls onChange with correct key on click", () => {
    const onChange = vi.fn();
    render(<Tabs items={items} activeKey="overview" onChange={onChange} />);
    fireEvent.click(screen.getByText("Emisyonlar"));
    expect(onChange).toHaveBeenCalledWith("emissions");
  });

  it("marks active tab with data-active attribute", () => {
    render(<Tabs items={items} activeKey="facilities" onChange={() => {}} />);
    const activeTab = screen.getByText("Tesisler").closest("[data-tab]");
    expect(activeTab).toHaveAttribute("data-active", "true");
  });
});
```

- [ ] **Step 2: Testi çalıştır — fail bekleniyor**

```bash
npm run test -- Tabs
```

- [ ] **Step 3: Tabs.tsx'i yaz**

`apps/web/src/components/ui/Tabs.tsx`:

```tsx
interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  style?: React.CSSProperties;
}

export function Tabs({ items, activeKey, onChange, style }: TabsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "2px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "4px",
        width: "fit-content",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      {items.map(item => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            data-tab
            data-active={isActive}
            onClick={() => onChange(item.key)}
            style={{
              padding: "7px var(--space-4)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              border: isActive ? "1px solid var(--border-accent)" : "1px solid transparent",
              background: isActive ? "var(--accent-bg)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
              transition: "all 0.12s",
              fontFamily: "var(--font-sans)",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır — pass bekleniyor**

```bash
npm run test -- Tabs
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/Tabs.tsx apps/web/src/components/ui/__tests__/Tabs.test.tsx
git commit -m "feat(ui): Tabs bileşeni — aktif state, onChange callback"
```

---

### Task 12: DataTable Bileşeni

**Files:**
- Create: `apps/web/src/components/ui/DataTable.tsx`
- Create: `apps/web/src/components/ui/__tests__/DataTable.test.tsx`
- Create: `apps/web/src/components/ui/index.ts`

- [ ] **Step 1: Failing testi yaz**

`apps/web/src/components/ui/__tests__/DataTable.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable } from "../DataTable";

const columns = [
  { key: "name", header: "Tesis" },
  { key: "emission", header: "Emisyon" },
  { key: "status", header: "Durum" },
];

const data = [
  { name: "İzmir Fabrikası", emission: "8,420 t", status: "Aktif" },
  { name: "Ankara Depo", emission: "3,240 t", status: "İncelemede" },
];

describe("DataTable", () => {
  it("renders column headers", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("Tesis")).toBeInTheDocument();
    expect(screen.getByText("Emisyon")).toBeInTheDocument();
  });

  it("renders row data", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("İzmir Fabrikası")).toBeInTheDocument();
    expect(screen.getByText("3,240 t")).toBeInTheDocument();
  });

  it("calls onRowClick with row data when clicked", () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={data} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("Ankara Depo"));
    expect(onRowClick).toHaveBeenCalledWith(data[1]);
  });
});
```

- [ ] **Step 2: Testi çalıştır — fail bekleniyor**

```bash
npm run test -- DataTable
```

- [ ] **Step 3: DataTable.tsx'i yaz**

`apps/web/src/components/ui/DataTable.tsx`:

```tsx
interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  style?: React.CSSProperties;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  style,
}: DataTableProps<T>) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={String(col.key)}
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  textAlign: "left",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "var(--text-muted)",
                  borderBottom: "1px solid var(--border)",
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              style={{
                cursor: onRowClick ? "pointer" : "default",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => {
                if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-elevated)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
              }}
            >
              {columns.map(col => (
                <td
                  key={String(col.key)}
                  style={{
                    padding: "10px var(--space-3)",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-primary)",
                    borderBottom: i < data.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  {col.render
                    ? col.render(row[col.key], row)
                    : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Testi çalıştır — pass bekleniyor**

```bash
npm run test -- DataTable
```

- [ ] **Step 5: Barrel export oluştur**

`apps/web/src/components/ui/index.ts`:

```ts
export { Button } from "./Button";
export { Badge } from "./Badge";
export { Card } from "./Card";
export { Input } from "./Input";
export { StatCard } from "./StatCard";
export { Tabs } from "./Tabs";
export { DataTable } from "./DataTable";
```

- [ ] **Step 6: Tüm testleri çalıştır**

```bash
cd apps/web && npm run test
```

Beklenen: `23 tests passed` (4+3+3+4+3+3+3)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ui/DataTable.tsx apps/web/src/components/ui/__tests__/DataTable.test.tsx apps/web/src/components/ui/index.ts
git commit -m "feat(ui): DataTable + barrel export — component library tamamlandı"
```

---

## FAZ 3 — AppShell & Navigation

---

### Task 13: AppShell Yeniden Yazımı

**Files:**
- Modify: `apps/web/src/components/AppShell.tsx`

- [ ] **Step 1: AppShell.tsx'i yeniden yaz**

Mevcut dosyada emoji string'ler (`icon: "📊"` gibi) kullanılıyor. Yeni versiyonda Lucide icon component'leri kullanılacak. `NavItem` interface'indeki `icon: string` → `icon: React.ComponentType<{size?: number; strokeWidth?: number}>` olacak.

`apps/web/src/components/AppShell.tsx` dosyasının tamamını şununla değiştir:

```tsx
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Zap, Factory, Leaf, Database,
  Radio, GitBranch, FileText, ShieldCheck, TrendingUp,
  Sliders, Settings, ChevronRight, ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import TopBar from "./TopBar.js";

interface SubItem  { icon?: LucideIcon; label: string; path: string; }
interface NavItem  { icon: LucideIcon; label: string; path: string; badge?: string; children?: SubItem[]; }
interface NavGroup { title: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Ana Menü",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",       path: "/dashboard" },
    ],
  },
  {
    title: "Ürünler",
    items: [
      { icon: Zap,        label: "24/7 CFE Matching", path: "/cfe",
        children: [
          { label: "Portföy",      path: "/cfe" },
          { label: "Eşleştirme",   path: "/cfe/matching" },
          { label: "Veri Girişi",  path: "/cfe/data-entry" },
          { label: "Sertifikalar", path: "/cfe/certificates" },
          { label: "Tesisler",     path: "/cfe/facilities" },
          { label: "Green Assets", path: "/cfe/green-assets" },
        ],
      },
      { icon: Factory,    label: "CBAM Emissions",    path: "/cbam",
        children: [
          { label: "Tesisler",     path: "/cbam" },
          { label: "Teknik Dosya", path: "/reports/cbam" },
        ],
      },
      { icon: Leaf,       label: "GEC Scope 1",       path: "/gec" },
      { icon: Database,   label: "EF Veri Servisi",   path: "/ef-data" },
      { icon: Radio,      label: "Canlı & Tahmin",    path: "/live-forecast", badge: "LIVE" },
      { icon: GitBranch,  label: "ESG Playground",    path: "/esg-playground" },
    ],
  },
  {
    title: "Raporlamalar",
    items: [
      { icon: FileText,    label: "CDP / ISO / GHG",  path: "/reports/cdp" },
      { icon: ShieldCheck, label: "CSRD E1",           path: "/csrd" },
    ],
  },
  {
    title: "Araçlar",
    items: [
      { icon: TrendingUp, label: "Karbon Fiyatları",  path: "/carbon-prices" },
      { icon: Sliders,    label: "Araçlar",            path: "/comparison" },
      { icon: Settings,   label: "Ayarlar",            path: "/settings" },
    ],
  },
];

/* ── Secondary nav ────────────────────────────────────────── */
interface SubNavTab { label: string; path: string; exact?: boolean; }
interface SubNavConfig { prefix: string; tabs: SubNavTab[]; }

const SUBNAVS: SubNavConfig[] = [
  {
    prefix: "/cfe",
    tabs: [
      { label: "Portföy",      path: "/cfe",              exact: true },
      { label: "Eşleştirme",  path: "/cfe/matching" },
      { label: "Veri Girişi", path: "/cfe/data-entry" },
      { label: "Sertifikalar",path: "/cfe/certificates" },
      { label: "Tesisler",    path: "/cfe/facilities" },
      { label: "Green Assets",path: "/cfe/green-assets" },
    ],
  },
  {
    prefix: "/live-forecast",
    tabs: [
      { label: "Piyasa Fiyatları",  path: "/live-forecast",            exact: true },
      { label: "RE Üretimi",        path: "/live-forecast/generation" },
      { label: "Karbon Yoğunluğu", path: "/live-forecast/carbon" },
      { label: "Optimal Pencere",   path: "/live-forecast/optimal" },
    ],
  },
  {
    prefix: "/ef-data",
    tabs: [
      { label: "Dashboard",     path: "/ef-data",         exact: true },
      { label: "Zone Tarayıcı", path: "/ef-data/zones" },
      { label: "Kapsam",        path: "/ef-data/coverage" },
      { label: "API Docs",      path: "/ef-data/api" },
    ],
  },
];

function isActive(path: string, pathname: string, exact?: boolean): boolean {
  if (exact) return pathname === path;
  if (path === "/cbam") return pathname === "/cbam" || pathname.startsWith("/cbam/");
  if (path === "/cfe")  return pathname === "/cfe"  || pathname.startsWith("/cfe/");
  return pathname === path || pathname.startsWith(path + "/");
}

function NavItemRow({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const location = useLocation();
  const [open, setOpen] = useState(() =>
    item.children?.some(c => isActive(c.path, location.pathname)) ?? false
  );
  const active = isActive(item.path, location.pathname);
  const Icon = item.icon;

  if (!item.children) {
    return (
      <Link
        to={item.path}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          padding: "8px 10px",
          borderRadius: "var(--radius-md)",
          color: active ? "var(--accent)" : "var(--text-secondary)",
          background: active ? "var(--accent-bg)" : "transparent",
          border: active ? "1px solid var(--border-accent)" : "1px solid transparent",
          fontSize: "var(--text-sm)",
          fontWeight: active ? 600 : 500,
          textDecoration: "none",
          marginBottom: "1px",
          position: "relative",
          fontFamily: "var(--font-sans)",
          transition: "background 0.12s, color 0.12s",
        }}
      >
        {active && (
          <span style={{
            position: "absolute",
            left: "-10px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "3px",
            height: "18px",
            background: "var(--accent)",
            borderRadius: "0 2px 2px 0",
          }} />
        )}
        <Icon size={15} strokeWidth={2} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.badge && (
          <span style={{
            background: "var(--accent-bg)",
            color: "var(--accent)",
            border: "1px solid var(--border-accent)",
            fontSize: "9px",
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: "var(--radius-pill)",
            letterSpacing: "0.5px",
          }}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          padding: "8px 10px",
          borderRadius: "var(--radius-md)",
          color: active || open ? "var(--text-primary)" : "var(--text-secondary)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          width: "100%",
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          marginBottom: "1px",
          fontFamily: "var(--font-sans)",
          transition: "background 0.12s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--border)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <Icon size={15} strokeWidth={2} style={{ flexShrink: 0, opacity: 0.7 }} />
        <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
        <ChevronRight size={13} style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0)" }} />
      </button>

      {open && (
        <div style={{ paddingLeft: "24px", marginBottom: "4px" }}>
          {item.children!.map(child => {
            const childActive = isActive(child.path, location.pathname, child.path === item.path);
            return (
              <Link
                key={child.path}
                to={child.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  color: childActive ? "var(--accent)" : "var(--text-muted)",
                  borderLeft: `1px solid ${childActive ? "var(--border-accent)" : "var(--border)"}`,
                  fontSize: "var(--text-sm)",
                  fontWeight: childActive ? 600 : 400,
                  textDecoration: "none",
                  marginBottom: "1px",
                  fontFamily: "var(--font-sans)",
                  transition: "color 0.12s",
                }}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AppShellProps { children: ReactNode; }

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const { user } = useAuth();
  const displayName = (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? "";
  const initials = displayName.slice(0, 2).toUpperCase();

  const activeSubnav = SUBNAVS.find(s => location.pathname.startsWith(s.prefix));

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)", fontFamily: "var(--font-sans)" }}>
      {/* SIDEBAR */}
      <aside style={{
        width: "220px",
        minWidth: "220px",
        background: "var(--bg-sidebar)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "18px 16px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{
            width: "30px",
            height: "30px",
            background: "linear-gradient(135deg, var(--accent), var(--accent-muted))",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 800,
            color: "var(--bg-base)",
            flexShrink: 0,
          }}>
            V
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#e2f0ea", letterSpacing: "-0.3px" }}>
              Voltfox
            </div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.5px" }}>
              ESG Platform
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
          {NAV_GROUPS.map(group => (
            <div key={group.title} style={{ marginBottom: "8px" }}>
              <div style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.25)",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                padding: "6px 10px 4px",
              }}>
                {group.title}
              </div>
              {group.items.map(item => (
                <NavItemRow key={item.path} item={item} />
              ))}
            </div>
          ))}
        </div>

        {/* User footer */}
        <div style={{
          padding: "10px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 10px",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            transition: "background 0.12s",
          }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, var(--accent), var(--accent-muted))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--bg-base)",
              flexShrink: 0,
            }}>
              {initials || "U"}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#e2f0ea", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {displayName || "Kullanıcı"}
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Admin</div>
            </div>
            <ChevronsUpDown size={13} style={{ marginLeft: "auto", color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar onMenuToggle={() => {}} mobile={false} />

        {/* Secondary subnav */}
        {activeSubnav && (
          <div style={{
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border)",
            padding: "0 var(--space-6)",
            display: "flex",
            gap: "2px",
            flexShrink: 0,
          }}>
            {activeSubnav.tabs.map(tab => {
              const tabActive = tab.exact ? location.pathname === tab.path : location.pathname === tab.path;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  style={{
                    padding: "10px var(--space-4)",
                    fontSize: "var(--text-sm)",
                    fontWeight: tabActive ? 600 : 500,
                    color: tabActive ? "var(--accent)" : "var(--text-secondary)",
                    borderBottom: tabActive ? "2px solid var(--accent)" : "2px solid transparent",
                    textDecoration: "none",
                    transition: "color 0.12s",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Dev sunucusunu başlat ve AppShell'i doğrula**

```bash
npm run dev
```

Tarayıcıda kontrol et:
- Sidebar açılıyor
- Lucide icon'lar görünüyor (emoji yok)
- CFE Matching altmenüsü açılıp kapanıyor
- LIVE badge Radio icon'unun yanında görünüyor
- Active route sol çizgiyle işaretleniyor
- User footer'da isim baş harfleri görünüyor

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AppShell.tsx
git commit -m "feat(design-system): AppShell yeniden yazıldı — Lucide icons, section label'lar, active indicator"
```

---

### Task 14: TopBar Güncelleme

**Files:**
- Modify: `apps/web/src/components/TopBar.tsx`

- [ ] **Step 1: TopBar.tsx'i güncelle**

Mevcut TopBar'da `getPageTitle()` ile breadcrumb string var ama tek parça gösteriliyor. Yeni versiyonda parent/current breadcrumb + Lucide icon'lı aksiyon butonları olacak.

`apps/web/src/components/TopBar.tsx` dosyasını şununla değiştir:

```tsx
import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sun, Moon, Bell, HelpCircle, Search } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../hooks/useAuth.js";
import { useTheme } from "../contexts/ThemeContext.js";
import NotificationBell from "./NotificationBell.js";
import GlobalSearch from "./GlobalSearch.js";

interface BreadcrumbEntry { label: string; path?: string; }

const ROUTE_MAP: Record<string, { parent?: string; label: string }> = {
  "/dashboard":        { label: "Dashboard" },
  "/gec":              { parent: "Ürünler", label: "GEC Scope 1" },
  "/cbam":             { parent: "Ürünler", label: "CBAM Emissions" },
  "/reports/cbam":     { parent: "CBAM Emissions", label: "Teknik Dosya" },
  "/reports/cdp":      { parent: "Raporlamalar", label: "CDP Raporu" },
  "/reports/iso14064": { parent: "Raporlamalar", label: "ISO 14064" },
  "/reports/ghg":      { parent: "Raporlamalar", label: "GHG Protocol" },
  "/csrd":             { parent: "Raporlamalar", label: "CSRD E1" },
  "/carbon-prices":    { parent: "Araçlar", label: "Karbon Fiyatları" },
  "/comparison":       { parent: "Araçlar", label: "Tesis Karşılaştırma" },
  "/emission-targets": { parent: "Araçlar", label: "Emisyon Hedefleri" },
  "/import":           { parent: "Araçlar", label: "CSV Import" },
  "/benchmark":        { parent: "Araçlar", label: "Sektör Benchmark" },
  "/integrations":     { parent: "Araçlar", label: "Entegrasyonlar" },
  "/api-playground":   { parent: "Araçlar", label: "API Playground" },
  "/settings":         { label: "Ayarlar" },
  "/profile":          { label: "Profil" },
  "/esg-playground":   { parent: "Ürünler", label: "ESG Playground" },
  "/ef-data":          { parent: "Ürünler", label: "EF Veri Servisi" },
  "/live-forecast":    { parent: "Ürünler", label: "Canlı & Tahmin" },
};

function getBreadcrumb(pathname: string): BreadcrumbEntry[] {
  if (pathname.startsWith("/cfe")) return [{ label: "Ürünler" }, { label: "24/7 CFE Matching" }];
  if (pathname.startsWith("/cbam/facilities/") && pathname.includes("/products/")) {
    return [{ label: "Ürünler" }, { label: "CBAM Emissions", path: "/cbam" }, { label: "Ürün Detayı" }];
  }
  if (pathname.startsWith("/cbam/facilities/")) {
    return [{ label: "Ürünler" }, { label: "CBAM Emissions", path: "/cbam" }, { label: "Tesis Detayı" }];
  }
  if (pathname.startsWith("/installations/") && pathname.includes("/periods/")) {
    return [{ label: "Dönem Detayı" }];
  }
  if (pathname.startsWith("/installations/")) {
    return [{ label: "Tesis Detayı" }];
  }
  if (pathname.startsWith("/admin")) return [{ label: "Admin Panel" }];

  const entry = ROUTE_MAP[pathname];
  if (!entry) return [{ label: "Voltfox" }];
  if (entry.parent) return [{ label: entry.parent }, { label: entry.label }];
  return [{ label: entry.label }];
}

interface TopBarProps {
  onMenuToggle: () => void;
  mobile: boolean;
}

export default function TopBar({ onMenuToggle, mobile }: TopBarProps) {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const breadcrumb = getBreadcrumb(location.pathname);
  const [searchOpen, setSearchOpen] = useState(false);

  const iconBtnStyle: React.CSSProperties = {
    width: "32px",
    height: "32px",
    borderRadius: "var(--radius-md)",
    background: "transparent",
    border: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "background 0.12s, color 0.12s",
    flexShrink: 0,
  };

  return (
    <header style={{
      height: "52px",
      minHeight: "52px",
      background: "var(--bg-surface)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      padding: "0 var(--space-6)",
      gap: "var(--space-3)",
      fontFamily: "var(--font-sans)",
    }}>
      {/* Breadcrumb */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "var(--text-sm)",
        color: "var(--text-muted)",
        flex: 1,
        minWidth: 0,
      }}>
        {breadcrumb.map((entry, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {i > 0 && <span style={{ opacity: 0.4 }}>/</span>}
            <span style={{
              color: i === breadcrumb.length - 1 ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
              whiteSpace: "nowrap",
            }}>
              {entry.label}
            </span>
          </span>
        ))}
      </div>

      {/* Search trigger */}
      <button
        onClick={() => setSearchOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          background: "var(--bg-base)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "6px 12px",
          color: "var(--text-muted)",
          fontSize: "var(--text-sm)",
          cursor: "pointer",
          width: "200px",
          fontFamily: "var(--font-sans)",
          transition: "border-color 0.12s",
        }}
      >
        <Search size={13} />
        <span style={{ flex: 1, textAlign: "left" }}>Ara...</span>
        <kbd style={{
          background: "var(--border)",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          fontSize: "9px",
          color: "var(--text-muted)",
          padding: "1px 5px",
          fontFamily: "var(--font-mono)",
        }}>
          ⌘K
        </kbd>
      </button>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <NotificationBell />

        <button style={iconBtnStyle} title="Yardım">
          <HelpCircle size={15} />
        </button>

        <button onClick={toggle} style={iconBtnStyle} title="Tema değiştir">
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      {/* Global search modal */}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
```

- [ ] **Step 2: Dev sunucusunda TopBar'ı doğrula**

```bash
npm run dev
```

Kontrol et:
- Breadcrumb farklı sayfalarda değişiyor
- Arama butonu `⌘K` kısayol gösteriyor
- Tema toggle butonu çalışıyor (Sun/Moon icon geçişi)
- Bildirim bell çalışıyor

- [ ] **Step 3: TypeScript derleme hatası yok mu kontrol et**

```bash
cd apps/web && npx tsc --noEmit
```

Beklenen: hata yok

- [ ] **Step 4: Tüm testleri son kez çalıştır**

```bash
npm run test
```

Beklenen: tüm testler geçiyor

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TopBar.tsx
git commit -m "feat(design-system): TopBar — breadcrumb nav, Lucide icons, arama trigger"
```

---

## Son Kontrol

- [ ] `npm run dev` — uygulama açılıyor, tema toggle çalışıyor, sidebar Lucide icons gösteriyor
- [ ] `npm run test` — tüm 28 test geçiyor
- [ ] `npx tsc --noEmit` — TypeScript hata yok
- [ ] `npm run build` — prod build başarılı

---

## Faz 4 Notu

Mevcut 50 sayfa hâlâ eski token isimlerini kullanıyor (`--bg`, `--bg-card`, `--text` vb.). Bu isimler `tokens.css`'deki backward-compat alias'ları sayesinde çalışmaya devam eder. Her sayfa güncellemesi için ayrı bir plan yazılacak — öncelik sırası: Dashboard → CBAM → CFE → GEC → diğerleri.
