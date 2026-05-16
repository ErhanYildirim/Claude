import { lookupGridEF, listSupportedCountries, EF_DATA_VERSION } from "./ef-data.js";

// ── Test 1: ISO2 ile lookup ───────────────────────────────────────────────────
{
  const tr = lookupGridEF("TR");
  console.assert(tr !== null,               "[FAIL] TR bulunamadı");
  console.assert(tr!.ef === 0.474,          `[FAIL] TR EF: ${tr?.ef}`);
  console.assert(tr!.iso2 === "TR",         `[FAIL] TR iso2: ${tr?.iso2}`);
  console.assert(tr!.dataVersion === EF_DATA_VERSION, "[FAIL] dataVersion yanlış");
  console.log("[PASS] TR ISO2 lookup — ef=0.474 tCO₂/MWh");
}

// ── Test 2: Küçük harf ISO2 ───────────────────────────────────────────────────
{
  const de = lookupGridEF("de");
  console.assert(de !== null,   "[FAIL] de (küçük harf) bulunamadı");
  console.assert(de!.ef === 0.380, `[FAIL] DE EF: ${de?.ef}`);
  console.log("[PASS] de küçük harf — ef=0.380 tCO₂/MWh");
}

// ── Test 3: Tam ülke adıyla lookup ───────────────────────────────────────────
{
  const fr = lookupGridEF("France");
  console.assert(fr !== null,   "[FAIL] France adıyla bulunamadı");
  console.assert(fr!.ef === 0.052, `[FAIL] FR EF: ${fr?.ef}`);
  console.log("[PASS] France tam ad lookup — ef=0.052 tCO₂/MWh (nükleer)");
}

// ── Test 4: Bulunamayan ülke → null ──────────────────────────────────────────
{
  const notFound = lookupGridEF("XX");
  console.assert(notFound === null, `[FAIL] XX null döndürmeli, döndürdü: ${notFound}`);
  console.log("[PASS] Bilinmeyen ülke → null");
}

// ── Test 5: Tüm ülke listesi ─────────────────────────────────────────────────
{
  const countries = listSupportedCountries();
  console.assert(countries.length >= 60,   `[FAIL] Ülke sayısı yetersiz: ${countries.length}`);
  console.assert(countries[0].iso2.length === 2, "[FAIL] ISO2 kodu 2 karakter olmalı");
  // Alfabetik sıralı mı?
  for (let i = 1; i < countries.length; i++) {
    console.assert(
      countries[i].name >= countries[i - 1].name,
      `[FAIL] Sıralama hatası: ${countries[i - 1].name} > ${countries[i].name}`
    );
  }
  console.log(`[PASS] ${countries.length} ülke listelendi, alfabetik sıralı`);
}

// ── Test 6: EF değerleri fiziksel sınırlar içinde ────────────────────────────
{
  const countries = listSupportedCountries();
  for (const c of countries) {
    console.assert(c.ef >= 0 && c.ef <= 2.0,
      `[FAIL] ${c.iso2} EF fiziksel sınır dışı: ${c.ef}`);
  }
  console.log("[PASS] Tüm EF değerleri 0–2.0 tCO₂/MWh aralığında");
}

// ── Test 7: Yüksek karbonlu ülkeler makul aralıkta ───────────────────────────
{
  const pl = lookupGridEF("PL"); // Polonya — kömür ağırlıklı
  const se = lookupGridEF("SE"); // İsveç — hidro + nükleer
  console.assert(pl!.ef > 0.5,  `[FAIL] Polonya EF çok düşük: ${pl?.ef}`);
  console.assert(se!.ef < 0.05, `[FAIL] İsveç EF çok yüksek: ${se?.ef}`);
  console.log(`[PASS] Polonya (kömür) EF=${pl!.ef} > 0.5, İsveç (hidro) EF=${se!.ef} < 0.05`);
}

console.log("\n✓ EF Data testleri tamamlandı");
