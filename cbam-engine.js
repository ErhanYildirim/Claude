var CBAMEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/cbam/browser.ts
  var browser_exports = {};
  __export(browser_exports, {
    EF_DATA_VERSION: () => EF_DATA_VERSION,
    FUEL_EF_SOURCE: () => FUEL_EF_SOURCE,
    FUEL_EF_TCO2_PER_MWH: () => FUEL_EF_TCO2_PER_MWH,
    calculateSEE: () => calculateSEE,
    calculateScope1FromFuelBreakdown: () => calculateScope1FromFuelBreakdown,
    calculateScope2: () => calculateScope2,
    compareWithDefault: () => compareWithDefault,
    listSupportedCountries: () => listSupportedCountries,
    lookupDefault: () => lookupDefault,
    lookupGridEF: () => lookupGridEF
  });

  // src/cbam/scope2.ts
  var CALC_ENGINE_VERSION = "1.0.0";
  function calculateScope2(electricity, timestamp) {
    const now = timestamp ?? (/* @__PURE__ */ new Date()).toISOString();
    if (electricity.consumedKwh < 0) throw new Error("Elektrik t\xFCketimi negatif olamaz.");
    if (electricity.matchingRatePct < 0 || electricity.matchingRatePct > 100) {
      throw new Error("E\u015Fle\u015Fme oran\u0131 0\u2013100 aras\u0131nda olmal\u0131.");
    }
    const consumedMwh = electricity.consumedKwh / 1e3;
    const matchRate = electricity.matchingRatePct / 100;
    const effectiveEf = matchRate * electricity.renewableEf + (1 - matchRate) * electricity.baselineEf;
    const effectiveTco2 = consumedMwh * effectiveEf;
    const baselineTco2 = consumedMwh * electricity.baselineEf;
    const reductionTco2 = baselineTco2 - effectiveTco2;
    const reductionPct = baselineTco2 > 0 ? reductionTco2 / baselineTco2 * 100 : 0;
    const auditTrail = [
      {
        field: "scope2.electricity_consumed_mwh",
        source: "user_input",
        value: consumedMwh,
        unit: "MWh",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION
      },
      {
        field: "scope2.baseline_ef",
        source: electricity.baselineEfSource,
        value: electricity.baselineEf,
        unit: "tCO\u2082/MWh",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION,
        note: electricity.baselineEfVersion ?? void 0
      },
      {
        field: "scope2.baseline_tco2",
        source: electricity.baselineEfSource,
        value: baselineTco2,
        unit: "tCO\u2082",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION,
        note: `${consumedMwh.toFixed(2)} MWh \xD7 ${electricity.baselineEf} (0% e\u015Fle\u015Fme)`
      },
      {
        field: "scope2.matching_rate_pct",
        source: "voltfox_gec_hourly",
        value: electricity.matchingRatePct,
        unit: "%",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION,
        note: electricity.gecDataVersion ?? void 0
      },
      {
        field: "scope2.renewable_ef",
        source: "voltfox_gec_hourly",
        value: electricity.renewableEf,
        unit: "tCO\u2082/MWh",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION
      },
      {
        field: "scope2.effective_ef",
        source: "voltfox_gec_hourly",
        value: effectiveEf,
        unit: "tCO\u2082/MWh",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION,
        note: `${electricity.matchingRatePct}% \xD7 ${electricity.renewableEf} + ${100 - electricity.matchingRatePct}% \xD7 ${electricity.baselineEf}`
      },
      {
        field: "scope2.effective_tco2",
        source: "voltfox_gec_hourly",
        value: effectiveTco2,
        unit: "tCO\u2082",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION,
        note: `azalt\u0131m: ${reductionTco2.toFixed(2)} tCO\u2082 (%${reductionPct.toFixed(1)})`
      }
    ];
    return {
      // voltfoxTco2 → effectiveTco2 olarak yeniden adlandırıldı (matching rate bazlı)
      voltfoxTco2: effectiveTco2,
      voltfoxEf: effectiveEf,
      baselineTco2,
      baselineEf: electricity.baselineEf,
      baselineEfSource: electricity.baselineEfSource,
      consumedKwh: electricity.consumedKwh,
      auditTrail,
      // Ek alanlar
      matchingRatePct: electricity.matchingRatePct,
      reductionTco2,
      reductionPct
    };
  }

  // src/cbam/scope1.ts
  var FUEL_EF_TCO2_PER_MWH = {
    natural_gas: 0.202,
    // 56.1 tCO₂/TJ → × 0.0036
    hard_coal: 0.341,
    // 94.6 tCO₂/TJ
    lignite: 0.361,
    // 100.3 tCO₂/TJ
    diesel: 0.266,
    // 73.9 tCO₂/TJ
    heavy_fuel_oil: 0.282,
    // 78.2 tCO₂/TJ
    lpg: 0.227,
    // 63.1 tCO₂/TJ
    coke: 0.386,
    // 107.2 tCO₂/TJ
    wood_biomass: 0,
    // biogenic — GHG Protocol Scope 1'den hariç
    other: 0.25
    // muhafazakâr tahmini değer
  };
  var FUEL_EF_SOURCE = "IPCC 2006 GL Vol.2 Table 1.4 / EN 16258 LHV";
  function calculateScope1FromFuelBreakdown(entries, calcEngineVersion, now) {
    const warnings = [];
    const lines = [];
    const auditTrail = [];
    let totalTco2 = 0;
    for (const entry of entries) {
      if (entry.consumedMwh < 0) {
        warnings.push(`${entry.fuelType}: negatif t\xFCketim de\u011Feri yoksay\u0131ld\u0131.`);
        continue;
      }
      const efUsed = entry.emissionFactorOverride ?? FUEL_EF_TCO2_PER_MWH[entry.fuelType];
      const efSource = entry.emissionFactorOverride ? "user_provided" : FUEL_EF_SOURCE;
      const isBiogenic = entry.fuelType === "wood_biomass";
      const tco2 = entry.consumedMwh * efUsed;
      if (isBiogenic && entry.consumedMwh > 0) {
        warnings.push(
          "Biyok\xFCtle (wood_biomass) biogenic CO\u2082 emisyonlar\u0131 GHG Protocol kapsam\u0131nda Scope 1 hesab\u0131na dahil edilmemi\u015Ftir. Ayr\u0131 raporlama gerekebilir."
        );
      }
      lines.push({ fuelType: entry.fuelType, consumedMwh: entry.consumedMwh, efUsed, efSource, tco2, biogenic: isBiogenic });
      totalTco2 += tco2;
      auditTrail.push({
        field: `scope1.fuel.${entry.fuelType}`,
        source: entry.emissionFactorOverride ? "user_provided" : "cbam_annex4_default",
        value: tco2,
        unit: "tCO\u2082",
        timestamp: now,
        calcEngineVersion,
        note: `${entry.consumedMwh} MWh \xD7 ${efUsed} tCO\u2082/MWh = ${tco2.toFixed(4)} tCO\u2082` + (entry.note ? ` (${entry.note})` : "") + (isBiogenic ? " [biogenic \u2014 hari\xE7]" : "")
      });
    }
    return { totalTco2, lines, auditTrail, warnings };
  }

  // src/cbam/see.ts
  var CALC_ENGINE_VERSION2 = "1.0.0";
  function calculateSEE(period) {
    if (period.productionVolumeTonnes <= 0) {
      throw new Error(`\xDCretim hacmi s\u0131f\u0131r veya negatif olamaz. D\xF6nem: ${period.label}`);
    }
    if (period.scope1DirectTco2 < 0) {
      throw new Error("Scope 1 emisyonu negatif olamaz.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const warnings = [];
    const scope2Exempt = period.scope2Exempt ?? false;
    let scope1Tco2 = period.scope1DirectTco2;
    if (period.fuelBreakdown && period.fuelBreakdown.length > 0) {
      const s1 = calculateScope1FromFuelBreakdown(period.fuelBreakdown, CALC_ENGINE_VERSION2, now);
      scope1Tco2 = s1.totalTco2;
      warnings.push(...s1.warnings);
    }
    const scope2 = calculateScope2(period.purchasedElectricity, now);
    let scope2BaselineTco2 = scope2.baselineTco2;
    let scope2VoltfoxTco2 = scope2.voltfoxTco2;
    if (scope2Exempt) {
      scope2BaselineTco2 = 0;
      scope2VoltfoxTco2 = 0;
      warnings.push(
        "Bu CN kodu CBAM ge\xE7i\u015F d\xF6neminde (2026\u20132028) Scope 2'den muaf tutulmu\u015Ftur. Dolayl\u0131 emisyon = 0 olarak raporlanm\u0131\u015Ft\u0131r (Ek-IV, Madde 4(2))."
      );
    }
    const totalBaseline = scope1Tco2 + scope2BaselineTco2;
    const seeBaseline = totalBaseline / period.productionVolumeTonnes;
    let seeVoltfox = null;
    if (scope2.voltfoxTco2 !== null) {
      const totalVoltfox = scope1Tco2 + scope2VoltfoxTco2;
      seeVoltfox = totalVoltfox / period.productionVolumeTonnes;
    } else {
      warnings.push(
        "Voltfox GEC saatlik e\u015Fle\u015Ftirme verisi yok. Baseline olarak \xFClke y\u0131ll\u0131k ortalama EF kullan\u0131ld\u0131. GEC entegrasyonuyla daha d\xFC\u015F\xFCk SEE elde edebilirsiniz."
      );
    }
    if (period.scope1DataQuality === "estimated") {
      warnings.push(
        "Scope 1 verisi 'tahmini' kalitesinde. Audit i\xE7in \xF6l\xE7\xFCm bazl\u0131 veriyle de\u011Fi\u015Ftirmeniz \xF6nerilir."
      );
    }
    const scope1AuditEntries = period.fuelBreakdown && period.fuelBreakdown.length > 0 ? calculateScope1FromFuelBreakdown(period.fuelBreakdown, CALC_ENGINE_VERSION2, now).auditTrail : [{
      field: "scope1.direct_tco2",
      source: "user_input",
      value: scope1Tco2,
      unit: "tCO\u2082",
      timestamp: now,
      calcEngineVersion: CALC_ENGINE_VERSION2,
      note: period.scope1AuditNote ?? "M\xFC\u015Fteri taraf\u0131ndan sa\u011Fland\u0131"
    }];
    const auditTrail = [
      ...scope1AuditEntries,
      ...scope2.auditTrail,
      ...scope2Exempt ? [{
        field: "scope2.exempt_override",
        source: "cbam_annex4",
        value: 0,
        unit: "tCO\u2082",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION2,
        note: "CN kodu ge\xE7i\u015F d\xF6neminde Scope 2 muafiyeti uyguland\u0131 (Ek-IV Md.4(2))"
      }] : [],
      {
        field: "see.baseline",
        source: "user_input",
        value: seeBaseline,
        unit: "tCO\u2082e/tonne",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION2,
        note: `(${scope1Tco2.toFixed(4)} + ${scope2BaselineTco2.toFixed(4)}) / ${period.productionVolumeTonnes}`
      },
      ...seeVoltfox !== null ? [{
        field: "see.voltfox_gec",
        source: "voltfox_gec_hourly",
        value: seeVoltfox,
        unit: "tCO\u2082e/tonne",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION2,
        note: `GEC e\u015Fle\u015Ftirmesiyle Scope 2 EF: ${scope2.voltfoxEf} tCO\u2082/MWh`
      }] : []
    ];
    const scope2Out = scope2Exempt ? { ...scope2, baselineTco2: 0, voltfoxTco2: 0, reductionTco2: 0, reductionPct: 0 } : scope2;
    return {
      scope1DirectTco2: scope1Tco2,
      scope1DataQuality: period.scope1DataQuality,
      scope2: scope2Out,
      seeBaseline,
      seeVoltfox,
      unit: "tCO2e/tonne",
      productionVolumeTonnes: period.productionVolumeTonnes,
      calcEngineVersion: CALC_ENGINE_VERSION2,
      calculatedAt: now,
      auditTrail,
      warnings
    };
  }

  // src/cbam/comparison.ts
  function compareWithDefault(seeResult, defaults, carbonPriceEur) {
    if (carbonPriceEur <= 0) {
      throw new Error("Karbon fiyat\u0131 pozitif olmal\u0131.");
    }
    const actualSee = seeResult.seeVoltfox ?? seeResult.seeBaseline;
    const defaultSee = defaults.totalDefault;
    const differenceAbs = defaultSee - actualSee;
    const differencePercent = differenceAbs / defaultSee * 100;
    const vol = seeResult.productionVolumeTonnes;
    const totalActualTco2 = actualSee * vol;
    const totalDefaultTco2 = defaultSee * vol;
    const annualSavingsEur = (totalDefaultTco2 - totalActualTco2) * carbonPriceEur;
    let recommendation;
    if (differencePercent >= 30) {
      recommendation = `Actual de\u011Feriniz default'un %${differencePercent.toFixed(0)} alt\u0131nda. Y\u0131ll\u0131k \u20AC${annualSavingsEur.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} tasarruf potansiyeli \u2014 AB ithalat\xE7\u0131n\u0131za Voltfox teknik dosyas\u0131n\u0131 g\xF6nderin.`;
    } else if (differencePercent > 0) {
      recommendation = `Actual de\u011Feriniz default'tan %${differencePercent.toFixed(1)} d\xFC\u015F\xFCk. Veri kalitesini art\u0131rarak (saatlik EF, \xF6l\xE7\xFCm verisi) tasarrufu b\xFCy\xFCtebilirsiniz.`;
    } else {
      recommendation = `Actual de\u011Feriniz default de\u011Ferden y\xFCksek. Enerji verimlili\u011Fi veya EF kayna\u011F\u0131 g\xF6zden ge\xE7irilmeli.`;
    }
    return {
      actualSee,
      defaultSee,
      differenceAbs,
      differencePercent,
      productionVolumeTonnes: vol,
      carbonPriceEur,
      totalActualTco2,
      totalDefaultTco2,
      annualSavingsEur,
      cnCode: defaults.cnCode,
      country: defaults.country,
      defaultDataVersion: defaults.dataVersion,
      comparedAt: (/* @__PURE__ */ new Date()).toISOString(),
      recommendation
    };
  }
  var ISO2_TO_NAME = {
    AL: "Albania",
    AM: "Armenia",
    AT: "Austria",
    AU: "Australia",
    AZ: "Azerbaijan",
    BA: "Bosnia and Herzegovina",
    BD: "Bangladesh",
    BE: "Belgium",
    BG: "Bulgaria",
    BR: "Brazil",
    BY: "Belarus",
    CA: "Canada",
    CH: "Switzerland",
    CN: "China",
    CY: "Cyprus",
    CZ: "Czech Republic",
    DE: "Germany",
    DK: "Denmark",
    DZ: "Algeria",
    EE: "Estonia",
    EG: "Egypt",
    ES: "Spain",
    FI: "Finland",
    FR: "France",
    GB: "United Kingdom",
    GE: "Georgia",
    GH: "Ghana",
    GR: "Greece",
    HR: "Croatia",
    HU: "Hungary",
    ID: "Indonesia",
    IE: "Ireland",
    IN: "India",
    IQ: "Iraq",
    IR: "Iran",
    IT: "Italy",
    JP: "Japan",
    KR: "South Korea",
    KZ: "Kazakhstan",
    LT: "Lithuania",
    LU: "Luxembourg",
    LV: "Latvia",
    LY: "Libya",
    MA: "Morocco",
    MD: "Moldova",
    ME: "Montenegro",
    MK: "North Macedonia",
    MT: "Malta",
    MX: "Mexico",
    NG: "Nigeria",
    NL: "Netherlands",
    NO: "Norway",
    PK: "Pakistan",
    PL: "Poland",
    PT: "Portugal",
    RO: "Romania",
    RS: "Serbia",
    RU: "Russia",
    SA: "Saudi Arabia",
    SE: "Sweden",
    SI: "Slovenia",
    SK: "Slovakia",
    TH: "Thailand",
    TN: "Tunisia",
    TR: "Turkey",
    UA: "Ukraine",
    AE: "United Arab Emirates",
    US: "United States",
    UZ: "Uzbekistan",
    VN: "Vietnam",
    ZA: "South Africa",
    AR: "Argentina"
  };
  function lookupDefault(cbamData, country, cnCode) {
    var _a;
    let rows = cbamData.countries[country];
    if (!rows && country.length === 2) {
      const fullName = ISO2_TO_NAME[country.toUpperCase()];
      if (fullName) rows = cbamData.countries[fullName];
    }
    if (!rows) return null;
    const row = rows.find((r) => r[0] === cnCode);
    if (!row) return null;
    return {
      cnCode,
      country,
      directDefault: row[1],
      indirectDefault: row[2],
      totalDefault: row[3],
      dataVersion: ((_a = cbamData.meta) == null ? void 0 : _a.version) ?? "2026-02-04"
    };
  }

  // src/cbam/ef-data.ts
  var EF_DATA_VERSION = "2024-IEA";
  var GRID_EF_TABLE = [
    // ── Avrupa Birliği ───────────────────────────────────────────────────────────
    { iso2: "DE", name: "Germany", ef: 0.38, source: "Umweltbundesamt 2023", year: 2023 },
    { iso2: "FR", name: "France", ef: 0.052, source: "RTE France 2023", year: 2023, notes: "N\xFCkleer a\u011F\u0131rl\u0131kl\u0131" },
    { iso2: "PL", name: "Poland", ef: 0.72, source: "IEA 2023", year: 2023, notes: "K\xF6m\xFCr a\u011F\u0131rl\u0131kl\u0131" },
    { iso2: "IT", name: "Italy", ef: 0.29, source: "Terna 2023", year: 2023 },
    { iso2: "ES", name: "Spain", ef: 0.19, source: "REE 2023", year: 2023 },
    { iso2: "NL", name: "Netherlands", ef: 0.37, source: "CBS/IEA 2023", year: 2023 },
    { iso2: "BE", name: "Belgium", ef: 0.15, source: "Elia 2023", year: 2023 },
    { iso2: "AT", name: "Austria", ef: 0.13, source: "E-Control 2023", year: 2023, notes: "Hidro a\u011F\u0131rl\u0131kl\u0131" },
    { iso2: "SE", name: "Sweden", ef: 0.013, source: "Energimyndigheten 2023", year: 2023, notes: "N\xFCkleer + hidro" },
    { iso2: "FI", name: "Finland", ef: 0.09, source: "Fingrid 2023", year: 2023 },
    { iso2: "DK", name: "Denmark", ef: 0.14, source: "Energinet 2023", year: 2023, notes: "R\xFCzgar a\u011F\u0131rl\u0131kl\u0131" },
    { iso2: "PT", name: "Portugal", ef: 0.19, source: "REN 2023", year: 2023 },
    { iso2: "CZ", name: "Czech Republic", ef: 0.45, source: "IEA 2023", year: 2023 },
    { iso2: "HU", name: "Hungary", ef: 0.23, source: "MAVIR 2023", year: 2023 },
    { iso2: "RO", name: "Romania", ef: 0.25, source: "Transelectrica 2023", year: 2023 },
    { iso2: "SK", name: "Slovakia", ef: 0.15, source: "IEA 2023", year: 2023 },
    { iso2: "BG", name: "Bulgaria", ef: 0.44, source: "IEA 2023", year: 2023 },
    { iso2: "HR", name: "Croatia", ef: 0.19, source: "HOPS 2023", year: 2023 },
    { iso2: "GR", name: "Greece", ef: 0.38, source: "ADMIE 2023", year: 2023 },
    { iso2: "IE", name: "Ireland", ef: 0.35, source: "EirGrid 2023", year: 2023 },
    { iso2: "LT", name: "Lithuania", ef: 0.23, source: "Litgrid 2023", year: 2023 },
    { iso2: "LV", name: "Latvia", ef: 0.1, source: "AST 2023", year: 2023, notes: "Hidro + do\u011Falgaz" },
    { iso2: "EE", name: "Estonia", ef: 0.48, source: "Elering 2023", year: 2023 },
    { iso2: "SI", name: "Slovenia", ef: 0.23, source: "ELES 2023", year: 2023 },
    { iso2: "LU", name: "Luxembourg", ef: 0.11, source: "IEA 2023", year: 2023 },
    { iso2: "MT", name: "Malta", ef: 0.49, source: "IEA 2023", year: 2023 },
    { iso2: "CY", name: "Cyprus", ef: 0.62, source: "IEA 2023", year: 2023, notes: "Ada, izole \u015Febeke" },
    // ── Avrupa (AB dışı) ─────────────────────────────────────────────────────────
    { iso2: "GB", name: "United Kingdom", ef: 0.235, source: "DESNZ/OFGEM 2023", year: 2023 },
    { iso2: "NO", name: "Norway", ef: 0.012, source: "NVE 2023", year: 2023, notes: "Neredeyse t\xFCm hidro" },
    { iso2: "CH", name: "Switzerland", ef: 0.03, source: "BAFU 2023", year: 2023, notes: "N\xFCkleer + hidro" },
    { iso2: "TR", name: "Turkey", ef: 0.474, source: "TE\u0130A\u015E 2023", year: 2023 },
    { iso2: "UA", name: "Ukraine", ef: 0.27, source: "Ukrenergo 2023", year: 2023 },
    { iso2: "RS", name: "Serbia", ef: 0.69, source: "IEA 2023", year: 2023, notes: "Linyit a\u011F\u0131rl\u0131kl\u0131" },
    { iso2: "BA", name: "Bosnia and Herzegovina", ef: 0.72, source: "IEA 2023", year: 2023 },
    { iso2: "ME", name: "Montenegro", ef: 0.44, source: "IEA 2023", year: 2023 },
    { iso2: "MK", name: "North Macedonia", ef: 0.68, source: "IEA 2023", year: 2023 },
    { iso2: "AL", name: "Albania", ef: 0.03, source: "IEA 2023", year: 2023, notes: "Neredeyse t\xFCm hidro" },
    { iso2: "MD", name: "Moldova", ef: 0.62, source: "IEA 2023", year: 2023 },
    { iso2: "BY", name: "Belarus", ef: 0.26, source: "IEA 2023", year: 2023 },
    { iso2: "RU", name: "Russia", ef: 0.33, source: "IEA 2023", year: 2023 },
    { iso2: "GE", name: "Georgia", ef: 0.09, source: "IEA 2023", year: 2023, notes: "Hidro a\u011F\u0131rl\u0131kl\u0131" },
    { iso2: "AM", name: "Armenia", ef: 0.2, source: "IEA 2023", year: 2023 },
    { iso2: "AZ", name: "Azerbaijan", ef: 0.43, source: "IEA 2023", year: 2023 },
    // ── Orta Doğu & Kuzey Afrika ─────────────────────────────────────────────────
    { iso2: "SA", name: "Saudi Arabia", ef: 0.54, source: "IEA 2023", year: 2023 },
    { iso2: "AE", name: "United Arab Emirates", ef: 0.38, source: "IEA 2023", year: 2023 },
    { iso2: "EG", name: "Egypt", ef: 0.45, source: "IEA 2023", year: 2023 },
    { iso2: "MA", name: "Morocco", ef: 0.64, source: "IEA 2023", year: 2023 },
    { iso2: "DZ", name: "Algeria", ef: 0.45, source: "IEA 2023", year: 2023 },
    { iso2: "TN", name: "Tunisia", ef: 0.44, source: "IEA 2023", year: 2023 },
    { iso2: "LY", name: "Libya", ef: 0.56, source: "IEA 2023", year: 2023 },
    { iso2: "IR", name: "Iran", ef: 0.54, source: "IEA 2023", year: 2023 },
    { iso2: "IQ", name: "Iraq", ef: 0.59, source: "IEA 2023", year: 2023 },
    // ── Asya-Pasifik ─────────────────────────────────────────────────────────────
    { iso2: "CN", name: "China", ef: 0.57, source: "CEA 2023", year: 2023 },
    { iso2: "IN", name: "India", ef: 0.7, source: "CEA India 2023", year: 2023, notes: "K\xF6m\xFCr a\u011F\u0131rl\u0131kl\u0131" },
    { iso2: "JP", name: "Japan", ef: 0.47, source: "METI 2023", year: 2023 },
    { iso2: "KR", name: "South Korea", ef: 0.44, source: "KEPCO 2023", year: 2023 },
    { iso2: "AU", name: "Australia", ef: 0.48, source: "AEMO 2023", year: 2023 },
    { iso2: "ID", name: "Indonesia", ef: 0.76, source: "IEA 2023", year: 2023 },
    { iso2: "VN", name: "Vietnam", ef: 0.51, source: "IEA 2023", year: 2023 },
    { iso2: "TH", name: "Thailand", ef: 0.49, source: "IEA 2023", year: 2023 },
    { iso2: "PK", name: "Pakistan", ef: 0.39, source: "IEA 2023", year: 2023 },
    { iso2: "BD", name: "Bangladesh", ef: 0.69, source: "IEA 2023", year: 2023 },
    { iso2: "KZ", name: "Kazakhstan", ef: 0.72, source: "IEA 2023", year: 2023, notes: "K\xF6m\xFCr a\u011F\u0131rl\u0131kl\u0131" },
    { iso2: "UZ", name: "Uzbekistan", ef: 0.56, source: "IEA 2023", year: 2023 },
    // ── Amerika ───────────────────────────────────────────────────────────────────
    { iso2: "US", name: "United States", ef: 0.38, source: "EPA eGRID 2023", year: 2023 },
    { iso2: "CA", name: "Canada", ef: 0.13, source: "ECCC 2023", year: 2023, notes: "Hidro + n\xFCkleer a\u011F\u0131rl\u0131kl\u0131" },
    { iso2: "MX", name: "Mexico", ef: 0.43, source: "IEA 2023", year: 2023 },
    { iso2: "BR", name: "Brazil", ef: 0.06, source: "ONS 2023", year: 2023, notes: "Neredeyse t\xFCm hidro" },
    { iso2: "AR", name: "Argentina", ef: 0.31, source: "IEA 2023", year: 2023 },
    // ── Afrika (CBAM kapsamındaki ihracatçı ülkeler) ──────────────────────────────
    { iso2: "ZA", name: "South Africa", ef: 0.87, source: "IEA 2023", year: 2023, notes: "K\xF6m\xFCr a\u011F\u0131rl\u0131kl\u0131" },
    { iso2: "NG", name: "Nigeria", ef: 0.43, source: "IEA 2023", year: 2023 },
    { iso2: "GH", name: "Ghana", ef: 0.3, source: "IEA 2023", year: 2023 }
  ];
  var byISO2 = new Map(
    GRID_EF_TABLE.map((e) => [e.iso2.toUpperCase(), e])
  );
  var byName = new Map(
    GRID_EF_TABLE.map((e) => [e.name.toLowerCase(), e])
  );
  function lookupGridEF(countryOrISO) {
    const upper = countryOrISO.toUpperCase();
    const lower = countryOrISO.toLowerCase();
    const entry = byISO2.get(upper) ?? byName.get(lower) ?? null;
    if (!entry) return null;
    return {
      iso2: entry.iso2,
      name: entry.name,
      ef: entry.ef,
      source: entry.source,
      year: entry.year,
      dataVersion: EF_DATA_VERSION,
      notes: entry.notes
    };
  }
  function listSupportedCountries() {
    return GRID_EF_TABLE.map((e) => ({ iso2: e.iso2, name: e.name, ef: e.ef })).sort((a, b) => a.name.localeCompare(b.name));
  }
  return __toCommonJS(browser_exports);
})();
//# sourceMappingURL=cbam-engine.js.map
