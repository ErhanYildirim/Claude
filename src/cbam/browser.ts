// Browser bundle entry point — window.CBAMEngine olarak expose edilir
// esbuild ile IIFE formatında derlenir: build-cbam-engine.js

export { calculateSEE } from "./see.js";
export { calculateScope2 } from "./scope2.js";
export { calculateScope1FromFuelBreakdown, FUEL_EF_TCO2_PER_MWH, FUEL_EF_SOURCE } from "./scope1.js";
export { lookupDefault, compareWithDefault } from "./comparison.js";
export { lookupGridEF, listSupportedCountries, EF_DATA_VERSION } from "./ef-data.js";
export type { ReportingPeriod, SEEResult, FuelType, FuelEntry, PurchasedElectricityInput } from "./types.js";
export type { DefaultValues, ComparisonResult } from "./comparison.js";
export type { Scope1BreakdownResult } from "./scope1.js";
