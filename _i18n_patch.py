import re, json
p = r'C:\Users\erhan\Downloads\Claude\cbam-risk-calculator.html'
h = open(p,encoding='utf-8').read()

REPLACES = [
  ('<title>CBAM Risk Hesaplayıcı | Voltfox</title>',
   '<title data-i18n="page_title">CBAM Risk Hesaplayıcı | Voltfox</title>'),
  ('<span class="tag">CBAM Risk Hesaplayıcı · DV v2026-02-04</span>',
   '<span class="tag" data-i18n="header_tag">CBAM Risk Hesaplayıcı · Referans Değerler v2026-02-04</span>'),
  ('<h1>AB Komisyonu <span class="accent">resmi default değerleri</span> ile gerçek CBAM riskinizi hesaplayın</h1>',
   '<h1><span data-i18n="h1_a">AB Komisyonu</span> <span class="accent" data-i18n="h1_b">resmi referans değerleri</span> <span data-i18n="h1_c">ile gerçek CBAM riskinizi hesaplayın</span></h1>'),
  ('<h2>Ürün, ülke ve operasyonel veriler</h2>',
   '<h2 data-i18n="card1_title">Ürün, menşe ve operasyonel parametreler</h2>'),
  ('<div class="sub">Veriler tarayıcınızda işlenir, hiçbir sunucuya gönderilmez.</div>',
   '<div class="sub" data-i18n="card1_sub">Tüm hesaplama tarayıcınızda gerçekleşir; veriler hiçbir sunucuya iletilmez.</div>'),
  ('<div class="section-title">1 · Ürün seçimi</div>',
   '<div class="section-title" data-i18n="s1">1 · Ürün ve menşe ülke</div>'),
  ('<label for="country">Menşe ülke</label>',
   '<label for="country" data-i18n="lbl_country">Menşe ülke</label>'),
  ('<label for="category">Sektör (filtre)</label>',
   '<label for="category" data-i18n="lbl_category">CBAM sektörü (filtre)</label>'),
  ('<select id="category"><option value="">Tümü</option></select>',
   '<select id="category"><option value="" data-i18n="opt_all">Tüm sektörler</option></select>'),
  ('<label for="product">CN kodu / ürün</label>',
   '<label for="product" data-i18n="lbl_product">KN (CN) kodu / ürün</label>'),
  ('<div class="section-title">2 · İhracat hacmi</div>',
   '<div class="section-title" data-i18n="s2">2 · AB ithalat hacmi</div>'),
  ('<label for="period">Default değer dönemi</label>',
   '<label for="period" data-i18n="lbl_period">Referans değer mark-up dönemi</label>'),
  ('<option value="v2026">2026 (+%10 mark-up)</option>',
   '<option value="v2026" data-i18n="opt_v2026">2026 (+%10 mark-up)</option>'),
  ('<option value="v2027">2027 (+%20 mark-up)</option>',
   '<option value="v2027" data-i18n="opt_v2027">2027 (+%20 mark-up)</option>'),
  ('<option value="v2028" selected>2028+ (+%30 mark-up)</option>',
   '<option value="v2028" selected data-i18n="opt_v2028">2028 ve sonrası (+%30 mark-up)</option>'),
  ('<div class="section-title">3 · Scope 2 (elektrik) — gerçek verileriniz</div>',
   '<div class="section-title" data-i18n="s3">3 · Scope 2 (elektrik) — gömülü dolaylı emisyonlar</div>'),
  ('<label for="elecPerUnit">Ürün başına elektrik tüketimi (MWh / ürün)</label>',
   '<label for="elecPerUnit" data-i18n="lbl_elec">Birim ürün başına elektrik tüketimi (MWh / ürün)</label>'),
  ('<label for="gridEF">Şebeke emisyon faktörü (tCO₂/MWh)</label>',
   '<label for="gridEF" data-i18n="lbl_grid">Şebeke emisyon faktörü (tCO₂ / MWh)</label>'),
  ('<label for="renewMWh">Yıllık yenilenebilir üretim/PPA hacminiz (MWh)</label>',
   '<label for="renewMWh" data-i18n="lbl_renew">Yıllık yenilenebilir enerji hacminiz (MWh) — kendi üretim, PPA veya I-REC</label>'),
  ('<span class="match-hero-badge">⚡ EŞLEŞTİRME METODOLOJİSİ</span>',
   '<span class="match-hero-badge" data-i18n="match_badge">⚡ EŞLEŞTİRME METODOLOJİSİ</span>'),
  ('<span class="match-hero-tag">CBAM Scope 2 maliyetinizi belirleyen tek faktör</span>',
   '<span class="match-hero-tag" data-i18n="match_tag">CBAM Scope 2 yükümlülüğünüzü belirleyen kritik faktör</span>'),
  ('<div class="section-title">4 · CBAM ekonomisi</div>',
   '<div class="section-title" data-i18n="s4">4 · CBAM finansal parametreleri</div>'),
  ('<label for="etsPrice">EU ETS (€/tCO₂)</label>',
   '<label for="etsPrice" data-i18n="lbl_ets">AB ETS sertifika fiyatı (€ / tCO₂)</label>'),
  ('<label for="domesticCarbon">Yerel karbon (€/tCO₂)</label>',
   '<label for="domesticCarbon" data-i18n="lbl_local">Menşe ülkede ödenen karbon fiyatı (€ / tCO₂)</label>'),
  ('<summary>Metodoloji</summary>',
   '<summary data-i18n="meth_sum">Hesaplama metodolojisi</summary>'),
  ('<h2>Sonuçlar</h2>',
   '<h2 data-i18n="card2_title">Sonuçlar</h2>'),
  ('<div class="sub" id="prodSummary">Bir ürün seçin.</div>',
   '<div class="sub" id="prodSummary" data-i18n="prod_empty">Bir ürün seçin.</div>'),
  ('<div class="ef-label"><span class="ef-dot direct"></span>Default direct</div>',
   '<div class="ef-label"><span class="ef-dot direct"></span><span data-i18n="ef_dir">Referans · doğrudan</span></div>'),
  ('<div class="ef-label"><span class="ef-dot indirect"></span>Default indirect</div>',
   '<div class="ef-label"><span class="ef-dot indirect"></span><span data-i18n="ef_ind">Referans · dolaylı (Scope 2)</span></div>'),
  ('<div class="ef-label"><span class="ef-dot actual"></span>Gerçekleşen indirect</div>',
   '<div class="ef-label"><span class="ef-dot actual"></span><span data-i18n="ef_act">Gerçekleşen Scope 2</span></div>'),
  ('<div class="ef-label"><strong>Toplam (sizin)</strong></div>',
   '<div class="ef-label"><strong data-i18n="ef_tot">Toplam (gerçek veriyle)</strong></div>'),
  ('Yıllık CBAM yükümlülüğü <small>(default değerle)</small>',
   '<span data-i18n="big_label">Yıllık CBAM yükümlülüğü</span> <small data-i18n="big_sub">(referans değerle)</small>'),
  ('Voltfox ile potansiyel yıllık tasarruf',
   '<span data-i18n="saving_label">Voltfox ile potansiyel yıllık tasarruf</span>'),
  ('Default indirect → Gerçek indirect',
   '<span data-i18n="saving_legend">Referans dolaylı → gerçekleşen dolaylı</span>'),
  ('<div class="kpi"><span class="k">Yıllık CBAM (sizin gerçek veriyle)</span><span class="v" id="cbamActual">€0</span></div>',
   '<div class="kpi"><span class="k" data-i18n="cbam_actual_label">Yıllık CBAM (gerçek veriyle)</span><span class="v" id="cbamActual">€0</span></div>'),
  ('<div class="kpi"><span class="k">Risk seviyesi</span><span class="v" id="risk">—</span></div>',
   '<div class="kpi"><span class="k" data-i18n="risk_label">CBAM risk seviyesi</span><span class="v" id="risk">—</span></div>'),
  ('<div class="viz-title">2026 → 2034 CBAM yükümlülüğü kademeli geçişi</div>',
   '<div class="viz-title" data-i18n="trend_title">2026 → 2034 CBAM yükümlülüğü kademeli geçişi</div>'),
  ('<button class="btn btn-primary" id="leadBtn">Detaylı analiz için demo talep et →</button>',
   '<button class="btn btn-primary" id="leadBtn" data-i18n="cta_lead">Detaylı analiz için demo talep et →</button>'),
  ('<label for="lname">Ad Soyad</label>',
   '<label for="lname" data-i18n="f_name">Ad Soyad</label>'),
  ('<label for="lcompany">Şirket</label>',
   '<label for="lcompany" data-i18n="f_co">Şirket</label>'),
  ('<label for="lemail">Kurumsal e-posta</label>',
   '<label for="lemail" data-i18n="f_email">Kurumsal e-posta</label>'),
  ('<label for="lphone">Telefon (opsiyonel)</label>',
   '<label for="lphone" data-i18n="f_phone">Telefon (opsiyonel)</label>'),
  ('<button class="btn btn-primary" type="submit" style="margin-top:12px">Raporumu gönder</button>',
   '<button class="btn btn-primary" type="submit" style="margin-top:12px" data-i18n="f_submit">CBAM raporumu gönderin</button>'),
  ('<span class="badge">QSI Doğrulamalı</span>',
   '<span class="badge" data-i18n="b_qsi">QSI Doğrulamalı</span>'),
]

changed = 0
for old,new in REPLACES:
    if old in h:
        h = h.replace(old, new, 1); changed += 1
    else:
        print('MISS:', old[:80])
print('replaced:', changed, '/', len(REPLACES))

# Wrap larger paragraphs and texts with data-i18n where they don't have a clean tag boundary
def wrap(needle, key, full=False):
    global h
    if needle in h:
        h = h.replace(needle, '<span data-i18n="'+key+'">'+needle+'</span>', 1)
        return True
    return False

wrap_targets = [
  ("Menşe ülke ve KN", "lede_skip"),  # we'll just match the lede paragraph differently
]

# Insert language selector in header
header_old = '<span class="tag" data-i18n="header_tag">CBAM Risk Hesaplayıcı · Referans Değerler v2026-02-04</span>'
header_new = '<div class="head-right"><select id="langSel" class="lang-sel" aria-label="Language"></select><span class="tag" data-i18n="header_tag">CBAM Risk Hesaplayıcı · Referans Değerler v2026-02-04</span></div>'
h = h.replace(header_old, header_new)

# Inject CSS for lang selector
css_inject = "  .head-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n  .lang-sel{background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:999px;padding:6px 10px;font-size:12px;font-weight:600;width:auto;cursor:pointer;font-family:inherit}\n  .lang-sel:focus{border-color:var(--accent);outline:none}\n"
h = h.replace('/* Matching methodology hero */', css_inject + '  /* Matching methodology hero */')

open(p,'w',encoding='utf-8').write(h)
print('done, size:', len(h))
