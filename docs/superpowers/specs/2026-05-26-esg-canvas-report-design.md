# ESG Canvas Raporu — Design Spec

## Özet

ESG Playground'da oluşturulan canvas'ları canlı platform verisiyle doldurup KPI formatında sunan, PDF ve Excel export destekleyen salt okunur rapor sayfası.

---

## Kapsam

**Dahil:**
- Yeni sayfa: `/esg-playground/:graphId/report`
- Canvas'daki 5 çıktı node türünü KPI kartlarına dönüştürme
- Enerji node'ları (grid/solar/wind) için canlı CI/RE% gösterimi
- PDF export (tarayıcı print API)
- Excel export (client-side `xlsx` kütüphanesi)
- Playground listesinden ve editör toolbar'ından navigasyon

**Dışarıda:**
- Hesaplama mantığı değişikliği (mevcut `liveValue` değerleri kullanılır)
- Snapshot bazlı veya dönem bazlı görünüm
- Sayfa tasarımı haricinde backend değişikliği

---

## Mimari

### Yeni dosyalar

```
apps/web/src/pages/EsgCanvasReportPage.tsx   — ana rapor sayfası
```

### Değiştirilen dosyalar

```
apps/web/src/App.tsx                          — yeni route eklenir
apps/web/src/components/TopBar.tsx            — ROUTE_MAP'e entry eklenir
apps/web/src/pages/EsgPlaygroundPage.tsx      — liste kartı + editör toolbar butonları
```

### Route

```
/esg-playground/:graphId/report
```

`App.tsx`'e eklenir:
```tsx
const EsgCanvasReportPage = lazy(() => import("./pages/EsgCanvasReportPage.js"));
// ...
<Route path="/esg-playground/:graphId/report" element={<EsgCanvasReportPage />} />
```

---

## Veri Akışı

```
EsgCanvasReportPage mount
  │
  ├─ api.esgPlayground.get(graphId)
  │    → nodesJson, edgesJson, name, templateCategory
  │
  ├─ parseNodes(nodesJson)
  │    → outputNodes: emissionCalcNode | cbamCalcNode | cfMatchingNode | ghgReportNode | cbamReportNode
  │    → energyNodes: gridNode | solarNode | windNode (zone bilgisi varsa)
  │
  ├─ api.esgPlayground.liveData(zones)   [energyNodes'dan zone listesi çıkarılır]
  │    → { zones: { [zone]: { ci, rePct, updatedAt } } }
  │
  └─ Render: KPI kartları + enerji satırı
       │
       └─ setInterval 30s → liveData yenilenir, updatedAt güncellenir
```

---

## Çıktı Node Türleri → KPI Kart Eşlemesi

| Node Türü | Kart Başlığı | Değer Kaynağı | Birim | Renk |
|---|---|---|---|---|
| `emissionCalcNode` | Emisyon Hesabı | `data.liveValue` | tCO₂e | #ef4444 |
| `cbamCalcNode` | CBAM Karbon Maliyeti | `data.liveValue` | € | #dc2626 |
| `cfMatchingNode` | CFE Eşleştirme Skoru | `data.liveValue` | % | #16a34a |
| `ghgReportNode` | GHG Toplam Emisyon | `data.liveValue` | tCO₂e | #7c3aed |
| `cbamReportNode` | CBAM Teknik Dosya | `data.subLabel` | — | #b91c1c |

Her kart:
- Renkli üst bordür (node rengiyle)
- Büyük metrik değer + birim
- Node `label` alanı (kullanıcının verdiği isim)
- `data.sourceType` varsa ilgili platform sayfasına link (→ tesis / ürün sayfasına git)
- `liveValue` `null`, `undefined` veya `""` ise: `—` gösterilir, kart gri border alır

---

## Enerji Canlı Veri Satırı

Canvas'da `gridNode`, `solarNode`, `windNode` varsa:
- `data.zone` alanından zone kodu çıkarılır
- `api.esgPlayground.liveData(zones)` çağrılır
- Her kaynak için küçük kart: ikon, zone adı, CI veya RE% değeri
- Zone yoksa veya API başarısızsa bu satır gizlenir (hata gösterilmez)

---

## Bileşen Yapısı

```
EsgCanvasReportPage
├── ReportHeader            — canvas adı, canlı badge, yenile, PDF/Excel butonları
├── CanvasMeta              — template kategori badge'leri, node sayısı özeti
├── KpiGrid                 — output node'lar için kart ızgarası
│   └── KpiCard (×N)        — tek bir çıktı node'u kartı
└── LiveDataRow             — enerji node'ları canlı değerleri (varsa)
```

Tüm bileşenler `EsgCanvasReportPage.tsx` içinde tanımlanır — tek dosya, dışa aktarım yok.

---

## Export

### PDF
`window.print()` ile tarayıcı print diyalogu.  
Print CSS (inline `<style media="print">`):
- `ReportHeader` butonları gizlenir
- Arka plan renkleri korunur (`-webkit-print-color-adjust: exact`)
- Kart ızgarası sayfa kırılmalarına duyarlı (`page-break-inside: avoid`)

### Excel
`xlsx` npm paketi frontend'e eklenir (yeni bağımlılık: `npm install xlsx --workspace=apps/web`).  
Export içeriği:
- Satır 1–2: Canvas adı, oluşturma tarihi
- Satır 4+: Her output node için: Node Adı | Değer | Birim | Son Güncelleme
- İkinci sheet: Enerji kaynakları — Zone | CI (gCO₂/kWh) | RE%

---

## Navigasyon

### Playground listesinden
`EsgPlaygroundPage.tsx` list view'daki canvas kartına buton eklenir:

```tsx
<button onClick={() => navigate(`/esg-playground/${graph.id}/report`)}>
  📊 Raporu Görüntüle
</button>
```

### Editör toolbar'ından
Canvas editörü açıkken üst toolbar'a ikon eklenir:

```tsx
<button onClick={() => navigate(`/esg-playground/${graphId}/report`)}>
  📊 Rapor
</button>
```

---

## Hata Durumları

| Durum | Davranış |
|---|---|
| Canvas bulunamadı (404) | `/esg-playground`'a yönlendir |
| Output node yok | "Bu canvas'ta rapor node'u bulunmuyor" empty state + playground'a dön linki |
| liveData API başarısız | Enerji satırı sessizce gizlenir, output node değerleri değişmez |
| `liveValue` boş/null | Kart gösterilir, değer alanında `—` yazar |

---

## Breadcrumb

`TopBar.tsx` ROUTE_MAP'e eklenir:

```ts
"/esg-playground/:graphId/report": { parent: "ESG Playground", label: "Canvas Raporu" }
```

Not: ROUTE_MAP sabit path'ler kullandığından `:graphId` içeren dynamic path buraya eklenemez. Bunun yerine `getBreadcrumb` fonksiyonuna `pathname.match(/^\/esg-playground\/.+\/report$/)` kontrolü eklenir.

---

## Test Edilecekler

1. Output node'u olmayan canvas → empty state görünür
2. Tüm 5 output node türü mevcut → 5 kart render edilir
3. liveData API 500 döndürür → sayfa çökmez, enerji satırı kaybolur
4. PDF print diyalogu açılır
5. Excel dosyası indirilir, doğru sheet yapısıyla
6. Listeden "Raporu Görüntüle" → doğru route'a gider
7. Editör toolbar "Rapor" butonu → doğru route'a gider
8. Geçersiz graphId → playground'a yönlendirir
