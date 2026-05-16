# PRD: CBAM Actual Emissions
**Versiyon:** 1.0  
**Tarih:** 2026-05-15  
**Yazar:** Voltfox Product  
**Durum:** Review

---

## 1. Sorun

### 1.1 Regülasyon Bağlamı
AB Karbon Sınır Düzenleme Mekanizması (CBAM), 2026'dan itibaren çelik, alüminyum, çimento, gübre ve elektrik sektörlerinde AB'ye ihracat yapan firmalar için zorunlu ödeme yükümlülüğü doğuruyor. Yükümlülük, beyan edilen **gömülü emisyon (embedded carbon)** miktarına göre hesaplanıyor.

**Kritik problem:** İhracatçı şirket gerçek üretim emisyon verisini sunmazsa, AB Komisyonu'nun yayımladığı **default değerler** uygulanıyor. Bu default değerler gerçek emisyonun 1.5x–3x üstünde tasarlanmış — ihracatçıyı actual değerleri sunmaya teşvik etmek için bilinçli yüksek tutulmuş.

**Sonuç:** Actual emissions belgeleyen bir Türk çelik ihracatçısı, default yerine kendi verisini kullanarak yıllık CBAM maliyetinden **%40–70 tasarruf** edebilir.

### 1.2 Müşteri Sorunu
> "Muhasebemiz ton başına karbonu hesaplamıyor, üretim mühendislerimiz de hangi verinin AB'nin istediği formatta olduğunu bilmiyor. Danışman tutacağız ama ne kadar sürer, ne kadar tutar, doğru mu hesaplandığını nasıl bileceğiz?"  
> — *Manisa'da çelik profil üreticisi, 50.000 t/yıl ihracat, Şubat 2026 müşteri görüşmesi*

### 1.3 Kanıtlar
- Beta müşteri görüşmelerinde 6/8 ihracatçı "CBAM için actual değeri nasıl hesaplayacağımızı bilmiyoruz" dedi
- CBAM risk hesaplayıcı kullanıcılarının %64'ü "default ile actual arasındaki farkı görmek istiyorum" seçeneğini tıkladı
- 2025 geçiş döneminde Türkiye'den 4.200+ ihracatçı CBAM beyanı verdi; bunların %78'i default değer kullandı (Komisyon açıklama verileri)

---

## 2. Hedef

Bir CBAM-maruz Türk ihracatçı, **Voltfox CBAM Actual Emissions** aracını kullanarak:

1. Üretim dönemi başına gerçek gömülü emisyon hesabını yapabilmeli
2. Bu hesabı AB ithalatçısına CBAM Direktifi Ek-IV uyumlu teknik dosya olarak iletebilmeli
3. Default vs. actual karşılaştırmasını Euro cinsinden görüp maliyet tasarrufunu doğrulayabilmeli

**Ölçülebilir hedef:** 2026 Q3 sonuna kadar 20 ihracatçı müşteri, Voltfox çıktısıyla AB ithalatçısına teknik dosya teslim etmiş olmalı.

---

## 3. Kullanıcı Hikayeleri

### Birincil Kullanıcı: İhracatçı (Sürdürülebilirlik / İhracat Müdürü)

- **US-1:** Bir ihracat müdürü olarak, üretim tesisimin enerji tüketimi ve hammadde verilerini sisteme girebilmek istiyorum ki hangi bilgilerin eksik olduğunu görebileyim.
- **US-2:** Bir sürdürülebilirlik sorumlusu olarak, belirli bir üretim dönemi (Q1/yıllık) için tCO₂e/ton hesabının nasıl yapıldığını adım adım görmek istiyorum ki iç audit ve danışmanlarıma açıklayabileyim.
- **US-3:** Bir ihracat müdürü olarak, hesaplanan actual değerimi AB Komisyonu default değeriyle ve CBAM sertifika maliyetiyle karşılaştırmak istiyorum ki yönetimime somut Euro tasarruf rakamı sunabileyim.
- **US-4:** Bir sürdürülebilirlik sorumlusu olarak, hesap çıktısını AB ithalatçısının CBAM beyanında kullanabileceği formatta dışa aktarmak istiyorum ki e-posta eki olarak gönderip işi bitirebileyim.

### İkincil Kullanıcı: AB İthalatçısı

- **US-5:** Bir AB ithalatçısı olarak, tedarikçimin gönderdiği Voltfox teknik dosyasını CBAM Authority beyanı sırasında yükleyebilmek istiyorum ki kendi yükümlülüğümü azaltabileyim.

### Üçüncül Kullanıcı: Voltfox İç Ekip (Onboarding)

- **US-6:** Bir Voltfox CSM olarak, müşterinin veri kalitesini (eksik sayaç, tahmini değer) sistemin uyarı göstermesinden anlayabilmek istiyorum ki müşteri görüşmesinde neyi çözeceğimi bilebileyim.

---

## 4. Kapsam

### 4.1 Bu Release'de Var (v1.0)

| # | Özellik | Öncelik |
|---|---------|---------|
| F-01 | Tesis & üretim dönemi tanımlama (çelik / alüminyum / çimento / gübre) | Must |
| F-02 | Scope 1 emisyon girişi: doğalgaz, fuel oil, kömür, proses emisyonları | Must |
| F-03 | Scope 2 emisyon girişi: satın alınan elektrik × EF (Voltfox GEC entegrasyonu) | Must |
| F-04 | Hammadde bazlı proses emisyonu hesabı (demir cevheri, CaCO₃, vb.) | Must |
| F-05 | tCO₂e/ton çıktısı + hesap açıklaması (audit trail) | Must |
| F-06 | Default vs. actual karşılaştırma paneli (Euro tasarruf dahil) | Must |
| F-07 | CBAM Ek-IV uyumlu PDF teknik dosya export | Must |
| F-08 | Çok tesis / çok dönem yönetimi | Should |
| F-09 | Veri kalite skoru + eksik veri uyarısı | Should |
| F-10 | İthalatçı ile paylaşım linki (read-only token) | Should |

### 4.2 Kapsam Dışı (v1.0)

- Otomatik ERP/enerji sayaç entegrasyonu (v1.1 hedef)
- Üçüncü taraf verifikasyon (akkreditasyon) akışı
- Alüminyum oksit gibi ikincil malzeme zincirleri (upstream emisyon)
- Doğrudan AB Komisyonu CBAM Registry API entegrasyonu
- İngilizce dışı teknik dosya lokalizasyonu (İtalyanca, Almanca)

---

## 5. Başarı Kriterleri

| KPI | Hedef | Ölçüm Yöntemi |
|-----|-------|---------------|
| Aktif ihracatçı müşteri | ≥ 20 (2026 Q3) | CRM — active subscription |
| Teknik dosya export | ≥ 15 müşteri en az 1 PDF export etmiş | Uygulama event log |
| Ortalama onboarding süresi | ≤ 3 iş günü (veri girişinden PDF'e) | Onboarding ticket ortalama |
| Müşteri başına NPS | ≥ 50 | 30. gün anket |
| Churn (ilk 6 ay) | ≤ %10 | CRM |
| Default → actual geçiş oranı | Müşteri portföyünün ≥ %80'i actual value kullanıyor | Beyan takip anketi |

---

## 6. Teknik Notlar

### 6.1 Bağımlılıklar
- **Voltfox GEC (Granular Emission Calculation):** Scope 2 EF beslemesi için zorunlu entegrasyon noktası. Kullanıcı GEC müşterisi değilse saatlik EF yerine ülke yıllık ortalama EF kullanılacak (düşük hassasiyet, kabul edilebilir v1.0 için).
- **CBAM default değer veritabanı:** `cbam-defaults.json` — CN kodu × ülke × dönem. Komisyon güncellemelerini takip eden cron güncelleme gerekiyor.
- **PDF render:** Ek-IV şablon XML → PDF pipeline; şablonun Komisyon güncellemelerinde otomatik versiyonlanması şart.

### 6.2 Veri Modeli (Özet)
```
Installation
  ├── id, name, country, sector (CN kodu)
  ├── ReportingPeriod (Q / Annual)
  │     ├── ProductionVolume (tonnes)
  │     ├── EnergyInputs[]  (fuel_type, quantity, NCV, EF)
  │     ├── ProcessEmissions[] (material, quantity, stoich_factor)
  │     └── PurchasedElectricity (kWh, EF_source, EF_value)
  └── EmbeddedEmission (tCO₂e/tonne, calc_version, audit_trail[])
```

### 6.3 Hesap Metodolojisi
CBAM Uygulama Tüzüğü (EU) 2023/1773 — Ek-IV, Method A (hesaplama bazlı) ve Method B (ölçüm bazlı). v1.0 Method A kapsamında.

**Formül:**
```
SEE = (DirectEmissions + IndirectEmissions) / ProductionVolume

DirectEmissions = Σ(Fuel_i × NCV_i × EF_i) + ProcessEmissions
IndirectEmissions = ElectricityConsumed × EF_grid
```

### 6.4 Audit Trail Zorunluluğu
Her hesap satırında: veri kaynağı (kullanıcı girişi / API / default), timestamp, hesap motoru versiyonu. Bu bilgi PDF'e gömülü metadata olarak da tutulmalı.

### 6.5 Güvenlik
- İhracatçı verisi (enerji tüketimi, üretim miktarı) ticari sır; tenant isolation zorunlu.
- Paylaşım linki: read-only JWT, 30 gün TTL, revoke edilebilir.

---

## 7. Regülasyon Bağlamı

| Kaynak | İlgisi |
|--------|--------|
| CBAM Tüzüğü (EU) 2023/956 | Temel yasal çerçeve, hangi sektörlerin kapsam dahilinde olduğu |
| Uygulama Tüzüğü (EU) 2023/1773 | Hesap metodolojisi Ek-IV, raporlama formatı |
| Komisyon Kılavuzu (CBAM Guidance v2.1) | Pratik hesap örnekleri, default değer kullanım koşulları |
| ISO 14064-1 | GHG envanter ilkeleri; auditor beklentileri |

**Önemli tarih:** 2026-01-01 — CBAM sertifika satın alma yükümlülüğü başladı. İhracatçıların bu tarihten itibaren Q1 beyanını Mayıs 2026'ya kadar vermeleri gerekiyor. **Aciliyet yüksek.**

---

## 8. Riskler ve Azaltma

| Risk | Olasılık | Etki | Azaltma |
|------|----------|------|---------|
| Komisyon Ek-IV formatını günceller | Orta | Yüksek | Şablon versiyonlama + 2 hafta içinde güncel PDF deploy |
| Müşteri veri kalitesi düşük (tahmini enerji faturası) | Yüksek | Orta | Veri kalite skoru + "estimated" flag ile kabul; doğrulama rehberi |
| GEC entegrasyonu gecikmesi | Düşük | Orta | v1.0'da ülke ortalaması EF fallback |
| İthalatçı teknik dosyayı kabul etmez (format) | Düşük | Yüksek | 2 beta ithalatçıyla pre-launch test |
| AB Registry API erken açılır, manuel yük artar | Orta | Orta | API entegrasyonu roadmap'te tutulmalı, sprint'e hazır backlog item |

---

## 9. Go-to-Market Notları (Product → Sales/Marketing)

- **Mesaj:** "Default değer ceza gibi çalışıyor — kendi verinle beyan yap, CBAM faturanı %40–70 düşür"
- **Hedef liste:** CBAM risk hesaplayıcı kullanan ve tasarruf rakamı gören 180+ lead; bunlara "hesabı artık yapabiliriz" outreach
- **Lansman önkoşulu:** En az 2 beta müşteri ile kapalı test + ithalatçı tarafında format onayı
- **Fiyatlama girdisi:** Tesis başına yıllık SaaS; çok tesis discount. Product → Sales için öneri: 2.500–6.000 €/tesis/yıl bandı (tasarrufun %2–5'i)

---

## 10. Açık Sorular

| # | Soru | Sahip | Hedef Tarih |
|---|------|-------|-------------|
| Q1 | Alüminyum sektörü için upstream (bauksit) emisyon kapsam dışı mı kalacak? | Engineering + Sales | 2026-05-22 |
| Q2 | İthalatçı paylaşım linkine verifikasyon notu (3. taraf imzası) eklenebilir mi v1.0'da? | Engineering | 2026-05-22 |
| Q3 | Gübre sektörü için N₂O emission factor validasyonu yapıldı mı? | Engineering | 2026-05-29 |
| Q4 | Komisyon, 2026 Q2 default değerlerini güncelledi mi? Veritabanımız güncel mi? | Engineering | 2026-05-16 |

---

*Bu PRD, Engineering fizibilite onayı ve co-founder alignment sonrası kesinleşir.*
