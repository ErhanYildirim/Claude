import { supabase } from "./supabase.js";

const BASE = "/api/v1";

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Oturum bulunamadı. Lütfen giriş yapın.");
  return {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${session.access_token}`,
  };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.message ?? err.error ?? "API hatası"), { status: res.status, body: err });
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Installations ─────────────────────────────────────────────────────────────
export const api = {
  installations: {
    list: () => request<{ installations: Installation[]; nextCursor: string | null; count: number }>("GET", "/installations")
      .then(r => r.installations),
    get:  (id: string) => request<InstallationDetail>("GET", `/installations/${id}`),
    create: (body: CreateInstallationBody) =>
      request<Installation>("POST", "/installations", body),
    update: (id: string, body: Partial<CreateInstallationBody>) =>
      request<Installation>("PATCH", `/installations/${id}`, body),
    delete: (id: string) => request<void>("DELETE", `/installations/${id}`),
  },

  periods: {
    create: (installationId: string, body: CreatePeriodBody) =>
      request<Period>("POST", `/installations/${installationId}/periods`, body),
    update: (installationId: string, periodId: string, body: Partial<UpdatePeriodBody>) =>
      request<Period>("PATCH", `/installations/${installationId}/periods/${periodId}`, body),
    calculate: (installationId: string, periodId: string) =>
      request<CalculationResult>("POST", `/installations/${installationId}/periods/${periodId}/calculate`),
    getResult: (installationId: string, periodId: string) =>
      request<EmbeddedEmission>("GET", `/installations/${installationId}/periods/${periodId}/result`),
    reportUrl: (installationId: string, periodId: string) =>
      `${BASE}/installations/${installationId}/periods/${periodId}/report`,
    exportUrl: (installationId: string, periodId: string, format: "json" | "xml" = "json") =>
      `${BASE}/installations/${installationId}/periods/${periodId}/export?format=${format}`,
    delete: (installationId: string, periodId: string) =>
      request<void>("DELETE", `/installations/${installationId}/periods/${periodId}`),
  },

  cfe: {
    submit: (installationId: string, periodId: string, body: CFEBody) =>
      request<CFEResult>("POST", `/installations/${installationId}/periods/${periodId}/cfe`, body),
    get: (installationId: string, periodId: string) =>
      request<CFEResult>("GET", `/installations/${installationId}/periods/${periodId}/cfe`),
    certificateUrl: (installationId: string, periodId: string, eacRef?: string) => {
      const q = eacRef ? `?eacRef=${encodeURIComponent(eacRef)}` : "";
      return `${BASE}/installations/${installationId}/periods/${periodId}/cfe/certificate${q}`;
    },
    importCsv: async (installationId: string, periodId: string, file: File): Promise<CsvImportResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Oturum bulunamadı.");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/installations/${installationId}/periods/${periodId}/cfe/import`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw Object.assign(new Error(err.message ?? err.error ?? "CSV yükleme hatası"), { status: res.status });
      }
      return res.json();
    },
  },

  defaults: {
    lookup: (country: string, cnCode: string) =>
      request<DefaultResult>("GET", `/defaults?country=${country}&cnCode=${cnCode}`),
    efList: () => request<EFListResult>("GET", "/defaults/ef"),
    efLookup: (country: string) => request<EFEntry>("GET", `/defaults/ef/${country}`),
  },

  members: {
    me:   () => request<MemberMe>("GET", "/members/me"),
    list: () => request<MemberList>("GET", "/members"),
    add:  (body: { userId: string; role: string }) => request("POST", "/members", body),
    invite: (body: { email: string; role: string }) =>
      request<{ member: unknown; invited: boolean; message: string }>("POST", "/members/invite", body),
    update: (userId: string, role: string) => request("PATCH", `/members/${userId}`, { role }),
    remove: (userId: string) => request<void>("DELETE", `/members/${userId}`),
    exportDataUrl: () => `${BASE}/members/me/export`,
    leave: () => request<void>("DELETE", "/members/me"),
  },

  apiKeys: {
    list:   () => request<ApiKeyList>("GET", "/api-keys"),
    create: (body: { name: string; scopes: string[]; expiresAt?: string }) =>
      request<NewApiKey>("POST", "/api-keys", body),
    revoke: (id: string) => request<void>("DELETE", `/api-keys/${id}`),
  },

  webhooks: {
    list:   () => request<WebhookList>("GET", "/webhooks"),
    create: (body: { url: string; events: string[] }) =>
      request<NewWebhook>("POST", "/webhooks", body),
    delete: (id: string) => request<void>("DELETE", `/webhooks/${id}`),
    deliveries: (id: string) => request<DeliveryList>("GET", `/webhooks/${id}/deliveries`),
  },

  auditLogs: {
    list: (params?: { resource?: string; resourceId?: string; action?: string; limit?: number; cursor?: string; from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.resource)   q.set("resource",   params.resource);
      if (params?.resourceId) q.set("resourceId", params.resourceId);
      if (params?.action)     q.set("action",     params.action);
      if (params?.limit)      q.set("limit",      String(params.limit));
      if (params?.cursor)     q.set("cursor",     params.cursor);
      if (params?.from)       q.set("from",       params.from);
      if (params?.to)         q.set("to",         params.to);
      const qs = q.toString();
      return request<AuditLogList>("GET", `/audit-logs${qs ? "?" + qs : ""}`);
    },
  },

  onboarding: {
    me:     () => request<OnboardingMe>("GET", "/onboarding/me"),
    createTenant: (companyName: string, timezone?: string) =>
      request<OnboardingResult>("POST", "/onboarding/tenant", { companyName, timezone }),
  },

  ef: {
    zones: () => request<EFZoneList>("GET", "/ef/zones"),
    zone:  (zoneId: string) => request<EFZoneSummary>("GET", `/ef/zones/${zoneId}`),
    hourly: (zoneId: string, start?: string, end?: string) => {
      const q = new URLSearchParams();
      if (start) q.set("start", start);
      if (end)   q.set("end",   end);
      return request<EFHourlyData>("GET", `/ef/zones/${zoneId}/hourly${q.toString() ? "?" + q : ""}`);
    },
    monthly: (zoneId: string, year?: number) => {
      const q = year ? `?year=${year}` : "";
      return request<EFMonthlyData>("GET", `/ef/zones/${zoneId}/monthly${q}`);
    },
    coverage:     () => request<EFCoverageData>("GET", "/ef/coverage"),
    importStatus: () => request<EFImportStatus>("GET", "/ef/import-status"),
  },

  gec: {
    columns: async (file: File): Promise<GecColumnsResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Oturum bulunamadı.");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/gec/columns`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw Object.assign(new Error(err.message ?? err.error ?? "Kolon bilgisi alınamadı"), { status: res.status });
      }
      return res.json();
    },
    calculate: async (file: File, zoneId?: string, periodId?: string, colMap?: GecColMap): Promise<GecResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Oturum bulunamadı.");
      const form = new FormData();
      form.append("file", file);
      const q = new URLSearchParams();
      if (zoneId)              q.set("zoneId",         zoneId);
      if (periodId)            q.set("periodId",        periodId);
      if (colMap?.hour)        q.set("colHour",         colMap.hour);
      if (colMap?.consumption) q.set("colConsumption",  colMap.consumption);
      if (colMap?.production)  q.set("colProduction",   colMap.production);
      if (colMap?.consUnit && colMap.consUnit !== "kWh") q.set("colConsUnit", colMap.consUnit);
      if (colMap?.prodUnit && colMap.prodUnit !== "kWh") q.set("colProdUnit", colMap.prodUnit);
      const qs = q.toString() ? "?" + q : "";
      const res = await fetch(`${BASE}/gec/calculate${qs}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw Object.assign(new Error(err.message ?? err.error ?? "GEC hesaplama hatası"), { status: res.status, body: err });
      }
      return res.json();
    },
  },

  tenant: {
    get:          () => request<{ tenant: TenantProfile }>("GET", "/tenant"),
    update:       (body: Partial<TenantProfileUpdate>) => request<{ tenant: TenantProfile }>("PATCH", "/tenant", body),
    timezones:    () => fetch("/api/v1/tenant/timezones").then(r => r.json() as Promise<{ timezones: string[] }>),
    subscription: () => request<TenantSubscription>("GET", "/tenant/subscription"),
  },

  notifications: {
    list:        () => request<NotificationList>("GET", "/notifications"),
    markRead:    (id: string) => request<void>("PATCH", `/notifications/${id}/read`),
    markAllRead: () => request<void>("PATCH", "/notifications/read-all"),
    delete:      (id: string) => request<void>("DELETE", `/notifications/${id}`),
    preferences: () => request<NotificationPrefs>("GET", "/notifications/preferences"),
    updatePrefs: (body: Partial<NotificationPrefs>) => request<NotificationPrefs>("PATCH", "/notifications/preferences", body),
  },

  search: {
    query: (params: { q?: string; type?: "installation" | "period" | "all"; sector?: string; country?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params.q)       qs.set("q",       params.q);
      if (params.type)    qs.set("type",    params.type);
      if (params.sector)  qs.set("sector",  params.sector);
      if (params.country) qs.set("country", params.country);
      if (params.limit)   qs.set("limit",   String(params.limit));
      return request<SearchResult>("GET", `/search?${qs.toString()}`);
    },
  },

  benchmark: {
    list:    () => request<{ results: BenchmarkResult[]; benchmarks: Record<string, BenchmarkRef> }>("GET", "/benchmark"),
    sectors: () => request<{ benchmarks: Record<string, BenchmarkRef> }>("GET", "/benchmark/sectors"),
  },

  cbamProducts: {
    list:   (installationId: string) =>
      request<{ products: CbamProduct[] }>("GET", `/installations/${installationId}/products`),
    create: (installationId: string, body: Partial<CbamProduct>) =>
      request<{ product: CbamProduct }>("POST", `/installations/${installationId}/products`, body),
    update: (installationId: string, productId: string, body: Partial<CbamProduct>) =>
      request<{ product: CbamProduct }>("PATCH", `/installations/${installationId}/products/${productId}`, body),
    delete: (installationId: string, productId: string) =>
      request<void>("DELETE", `/installations/${installationId}/products/${productId}`),

    periods: {
      list:      (instId: string, productId: string) =>
        request<{ product: CbamProduct; periods: CbamProductPeriod[] }>("GET", `/installations/${instId}/products/${productId}/periods`),
      create:    (instId: string, productId: string, body: Record<string, unknown>) =>
        request<{ period: CbamProductPeriod }>("POST", `/installations/${instId}/products/${productId}/periods`, body),
      update:    (instId: string, productId: string, periodId: string, body: Record<string, unknown>) =>
        request<{ period: CbamProductPeriod }>("PATCH", `/installations/${instId}/products/${productId}/periods/${periodId}`, body),
      calculate: (instId: string, productId: string, periodId: string) =>
        request<{ period: CbamProductPeriod; result: Record<string, unknown> }>(
          "POST", `/installations/${instId}/products/${productId}/periods/${periodId}/calculate`),
    },

    reference: () => request<CbamReference>("GET", "/cbam/reference"),
  },

  emissionTargets: {
    list:     (year?: number) => request<{ targets: EmissionTargetEntry[] }>("GET", `/emission-targets${year ? `?year=${year}` : ""}`),
    progress: (year?: number) => request<{ year: number; progress: EmissionTargetProgress[] }>("GET", `/emission-targets/progress${year ? `?year=${year}` : ""}`),
    create:   (body: { year: number; metric: string; targetValue: number; baselineValue?: number; installationId?: string; notes?: string }) =>
      request<EmissionTargetEntry>("POST", "/emission-targets", body),
    delete:   (id: string) => request<void>("DELETE", `/emission-targets/${id}`),
  },

  carbonPrices: {
    list:   () => request<{ prices: CarbonPriceEntry[] }>("GET", "/carbon-prices"),
    latest: () => request<{ price: CarbonPriceEntry | null }>("GET", "/carbon-prices/latest"),
    create: (body: { date: string; etsPriceEur: number; cbamEstEur?: number; source?: string; notes?: string }) =>
      request<CarbonPriceEntry>("POST", "/carbon-prices", body),
    delete: (id: string) => request<void>("DELETE", `/carbon-prices/${id}`),
  },

  admin: {
    metrics: () => request<AdminMetrics>("GET", "/admin/metrics"),

    tenants: {
      list:   (search = "") => request<AdminTenantList>("GET", `/admin/tenants${search ? `?search=${encodeURIComponent(search)}` : ""}`),
      get:    (id: string) => request<AdminTenantDetail>("GET", `/admin/tenants/${id}`),
      update: (id: string, body: { plan?: string; disabled?: boolean; name?: string }) =>
        request<AdminTenantDetail>("PATCH", `/admin/tenants/${id}`, body),
      delete: (id: string) => request<void>("DELETE", `/admin/tenants/${id}`),
    },

    users: {
      list:         (search = "", page = 1) => request<AdminUserList>("GET", `/admin/users?search=${encodeURIComponent(search)}&page=${page}`),
      ban:          (id: string, hours = 24) => request<{ banned: boolean }>("POST", `/admin/users/${id}/ban`, { hours }),
      unban:        (id: string) => request<{ banned: boolean }>("POST", `/admin/users/${id}/unban`),
      confirmEmail: (id: string) => request<{ emailConfirmed: boolean }>("POST", `/admin/users/${id}/confirm-email`),
      delete:       (id: string) => request<void>("DELETE", `/admin/users/${id}`),
      setSuperAdmin:(id: string, superAdmin: boolean) => request<{ isSuperAdmin: boolean }>("PATCH", `/admin/users/${id}/super-admin`, { superAdmin }),
    },

    ef: {
      zones:         (search = "") => request<AdminEfZoneList>("GET", `/admin/ef/zones${search ? `?search=${encodeURIComponent(search)}` : ""}`),
      triggerImport: () => request<{ message: string }>("POST", "/admin/ef/import"),
      deleteZone:    (code: string) => request<void>("DELETE", `/admin/ef/zones/${code}`),
    },

    announcements: {
      send:    (body: { title: string; body: string; tenantId?: string }) =>
        request<{ created: number; message: string }>("POST", "/admin/announcements", body),
      history: () => request<AdminAnnouncementList>("GET", "/admin/announcements"),
    },

    webhooks: {
      deliveries: (status?: string) =>
        request<AdminDeliveryList>("GET", `/admin/webhooks/deliveries${status ? `?status=${status}` : ""}`),
      retry: (id: string) => request<{ message: string }>("POST", `/admin/webhooks/deliveries/${id}/retry`),
      stats: () => request<AdminWebhookStats>("GET", "/admin/webhooks/stats"),
    },
    entso_e: {
      zones:       () => request<{ zones: EntsoeZone[]; count: number }>("GET", "/admin/entso-e/zones"),
      import:      (body: EntsoeImportBody) => request<{ message: string; zoneCode: string }>("POST", "/admin/entso-e/import", body),
      importLogs:  () => request<{ logs: EntsoeImportLog[] }>("GET", "/admin/entso-e/import-logs"),
    },
  },

  shareLinks: {
    create: (installationId: string, periodId: string, ttlDays?: number, password?: string) =>
      request<ShareLinkResult>("POST", "/share-links", { installationId, periodId, ttlDays, password }),
    update: (jti: string, body: { password?: string | null; expiresAt?: string }) =>
      request<void>("PATCH", `/share-links/${jti}`, body),
    revoke: (jti: string) => request<void>("DELETE", `/share-links/${jti}`),
  },

  share: {
    get: (token: string, password?: string) => {
      const qs = password ? `?pw=${encodeURIComponent(password)}` : "";
      return fetch(`${BASE}/share/${token}${qs}`).then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw Object.assign(new Error(err.error ?? "Geçersiz bağlantı"), { status: res.status, body: err });
        }
        return res.json() as Promise<ShareViewResult>;
      });
    },
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Installation {
  id: string; tenantId: string; facilityName: string;
  operator: string; facilityCountry: string; facilityRef: string | null;
  sector: string; createdAt: string; updatedAt: string;
  _count?: { periods: number };
}

export interface Period {
  id: string; installationId: string; periodName: string;
  startDate: string; endDate: string; reportYear: number;
  importCountry: string; cnCode: string; prodVolumeTonne: number;
  scope1DirectTco2: number; scope1Quality: string; scope1AuditNote: string | null;
  electricityKwh: number; electricitySource: string; baselineEf: number; renewableEf: number;
  matchingRatePct: number; gecConnected: boolean; carbonPriceEur: number | null;
  scope2Exempt: boolean; createdAt: string; result?: EmbeddedEmission;
}

export interface InstallationDetail extends Installation {
  periods: Period[];
}

export interface EmbeddedEmission {
  id: string; periodId: string;
  scope2BaselineTco2: number; scope2VoltfoxTco2: number;
  reductionTco2: number; reductionPct: number;
  seeBaseline: number; seeVoltfox: number;
  defaultSee: number | null; savingsVsDefaultEur: number | null;
  calcEngineVersion: string; efDataVersion: string; calculatedAt: string;
}

export interface CalculationResult {
  period: Period; see: unknown; comparison: unknown | null; stored: EmbeddedEmission;
}

export interface CFEBody { slots: Array<{ hour: string; consumptionKwh: number; productionKwh: number }>; gecDataVersion?: string; }
export interface CFEResult { cfeScore: number; totalConsumptionKwh: number; totalMatchedKwh: number; matchedHours: number; partialHours: number; unmatchedHours: number; monthlyBreakdown: MonthlyBreakdown[]; }
export interface MonthlyBreakdown { month: string; consumptionKwh: number; productionKwh: number; matchedKwh: number; cfeRate: number; }

export interface DefaultResult { cnCode: string; country: string; totalDefault: number; directDefault: number | null; indirectDefault: number | null; dataVersion: string; }
export interface MemberMe { role: string; }
export interface MemberList { members: Array<{ id: string; userId: string; role: string; createdAt: string }>; }
export interface ApiKeyList { keys: Array<{ id: string; name: string; prefix: string; scopes: string[]; expiresAt: string | null; lastUsedAt: string | null; createdAt: string }>; }
export interface NewApiKey { id: string; name: string; prefix: string; scopes: string[]; key: string; createdAt: string; }
export interface WebhookList { webhooks: Array<{ id: string; url: string; events: string[]; active: boolean; createdAt: string; _count: { deliveries: number } }>; }
export interface NewWebhook { id: string; url: string; events: string[]; secret: string; createdAt: string; }
export interface DeliveryList { deliveries: Array<{ id: string; event: string; status: string; attempts: number; responseStatus: number | null; deliveredAt: string | null; createdAt: string }>; }
export interface OnboardingMe { onboarded: boolean; userId: string; tenantId?: string; role?: string; tenant?: { id: string; name: string; slug: string }; }
export interface OnboardingResult { tenantId: string; slug: string; role: string; }
export interface ShareLinkResult { token: string; expiresAt: string; passwordProtected: boolean; }
export interface SearchResult {
  query: string;
  total: number;
  installations: Array<Installation & { _count: { periods: number } }>;
  periods: Array<Period & { installation: { id: string; facilityName: string; facilityCountry: string }; result: { seeVoltfox: number } | null }>;
}
export interface ShareViewResult {
  access: "readonly";
  payload: { tenantId: string; installationId: string; periodId: string; exp: number };
  result: {
    scope2BaselineTco2: number; scope2VoltfoxTco2: number;
    reductionTco2: number; reductionPct: number;
    seeBaseline: number; seeVoltfox: number;
    defaultSee: number | null; savingsVsDefaultEur: number | null;
    calcEngineVersion: string; efDataVersion: string; calculatedAt: string;
    period: {
      periodName: string; startDate: string; endDate: string;
      cnCode: string; importCountry: string; prodVolumeTonne: number;
      electricityKwh: number; scope1DirectTco2: number;
      installation: { facilityName: string; operator: string };
    };
  };
}

export interface AuditLogList {
  logs: Array<{ id: string; action: string; resource: string; resourceId: string; userId: string | null; payload: unknown; ipAddress: string | null; createdAt: string }>;
  nextCursor: string | null;
  count: number;
}

export interface CsvImportResult {
  rowCount: number; errorCount: number; errors: string[];
  result: { cfeScore: number; totalConsumptionKwh: number; totalMatchedKwh: number };
}
export interface EFEntry { iso2: string; name: string; ef: number; source: string; year: number; dataVersion: string; notes?: string; }
export interface EFListResult { dataVersion: string; countries: Array<{ iso2: string; name: string; ef: number }>; }

// EF Veri Servisi types
export interface EFZoneEntry { zoneId: string; zoneName: string; country: string; rowCount: number; }
export interface EFZoneList { count: number; zones: EFZoneEntry[]; }
export interface EFZoneSummary {
  zoneId: string; zoneName: string; country: string; year: number; granularity: string;
  ciDirect: { avg: number; min: number; max: number };
  cfePct: { avg: number }; rePct: { avg: number };
  rowCount: number; unit: string;
}
export interface EFHourlyPoint { hour: string; ciDirect: number; ciLifecycle: number; cfePct: number; rePct: number; dataEstimated: boolean; }
export interface EFHourlyData { zoneId: string; start: string; end: string; count: number; unit: string; data: EFHourlyPoint[]; }
export interface EFMonthlyPoint { month: number; monthName: string; avgCiDirect: number; avgCfePct: number; avgRePct: number; dataPoints: number; }
export interface EFMonthlyData { zoneId: string; year: number; months: EFMonthlyPoint[]; }

// EF Coverage types
export interface EFCoverageYear { year: number; rowCount: number; complete: boolean; }
export interface EFCoverageZone { zoneId: string; zoneName: string; country: string; years: EFCoverageYear[]; }
export interface EFCoverageData { zones: EFCoverageZone[]; availableYears: number[]; }

export interface EFImportLog {
  id: string; year: number; zoneId: string | null;
  rowsAdded: number; status: string; message: string | null;
  startedAt: string; endedAt: string; createdAt: string;
}
export interface EFImportStatus {
  lastImport: EFImportLog | null;
  totalRows: number;
  nextScheduledRun: string;
  schedule: string;
}

export interface BenchmarkRef {
  p25: number; median: number; p75: number; best: number; unit: string;
}
export interface BenchmarkResult {
  installationId: string; facilityName: string; facilityCountry: string;
  sector: string; latestYear: number | null; periodName: string | null;
  seeVoltfox: number | null; seeBaseline: number | null; defaultSee: number | null;
  benchmark: BenchmarkRef; percentile: string | null; vsMedianPct: number | null;
}

export interface EmissionTargetEntry {
  id: string; tenantId: string; installationId: string | null;
  year: number; metric: string; targetValue: number; baselineValue: number | null;
  notes: string | null; createdAt: string;
}
export interface EmissionTargetProgress extends EmissionTargetEntry {
  actualValue:    number | null;
  achievementPct: number | null;
  facilityName:   string;
}

// ── CBAM Product types ────────────────────────────────────────────────────────
export interface CbamProduct {
  id: string; tenantId: string; installationId: string;
  productName: string; cnCode: string | null; description: string | null;
  unit: string; isCbamScope: boolean; energyAllocationMode: "facility" | "band";
  createdAt: string; updatedAt: string;
  productPeriods: { id: string; reportYear: number; periodName: string; see: string | null; calculatedAt: string | null; }[];
}

export interface CbamProductPeriod {
  id: string; cbamProductId: string;
  reportYear: number; periodName: string; startDate: string; endDate: string;
  productionVolumeTonne: string;
  scope1DirectTco2: string; scope1AuditNote: string | null;
  bandElectricityKwh: string | null; bandRenewableKwh: string | null;
  facilityTotalKwh: string | null; facilityRenewableKwh: string | null; productShareKwh: string | null;
  renewableSource: string | null; renewableSourceEf: string | null;
  cbamDefaultEf: string | null; countryGridEf: string | null;
  allocatedElecKwh: string | null; allocatedRenewKwh: string | null;
  matchedKwh: string | null; unmatchedKwh: string | null;
  matchedIndirectTco2: string | null; unmatchedIndirectTco2: string | null;
  totalIndirectTco2: string | null; totalEmbeddedTco2: string | null;
  see: string | null; effectiveEf: string | null;
  unmatchedEfUsed: string | null; unmatchedEfSource: string | null;
  calculatedAt: string | null; createdAt: string; updatedAt: string;
}

export interface RenewableSource { key: string; label: string; efTco2Mwh: number; }
export interface CbamCountryEf   { country: string; efTco2Mwh: number; }
export interface CbamReference   { renewableSources: RenewableSource[]; cbamCountryEf: CbamCountryEf[]; }

export interface CarbonPriceEntry {
  id: string; date: string; etsPriceEur: number; cbamEstEur: number | null;
  source: string; notes: string | null; createdAt: string;
}

// Admin types
export interface AdminMetrics {
  tenantCount: number; installationCount: number; periodCount: number;
  cfeCount: number; auditCount30d: number; newTenants30d: number;
  dailyActivity: { day: string; count: number }[];
  asOf: string;
}
export interface AdminTenant {
  id: string; name: string; slug: string; plan: string; disabled: boolean;
  createdAt: string;
  _count: { members: number; installations: number };
}
export interface AdminTenantList  { tenants: AdminTenant[]; total: number; }
export interface AdminTenantDetail extends AdminTenant {
  members:       { userId: string; role: string; createdAt: string }[];
  installations: { id: string; facilityName: string; facilityCountry: string }[];
}
export interface AdminUser {
  id: string; email: string; createdAt: string; lastSignIn: string | null;
  banned: boolean; emailConfirmed: boolean; isSuperAdmin: boolean; tenantId: string | null;
}
export interface AdminUserList { users: AdminUser[]; total: number; }
export interface AdminEfZone { zoneCode: string; zoneName: string; country: string; updatedAt: string; }
export interface AdminEfZoneList { zones: AdminEfZone[]; count: number; }
export interface AdminAnnouncementList { items: { id: string; tenantId: string; title: string; body: string; createdAt: string }[]; }
export interface AdminDelivery {
  id: string; webhookId: string; status: string; statusCode: number | null;
  createdAt: string; durationMs: number | null;
  webhook: { url: string; tenantId: string };
}
export interface AdminDeliveryList { deliveries: AdminDelivery[]; total: number; }
export interface AdminWebhookStats { total: number; success: number; failed: number; pending: number; successRate: string; }

export interface EntsoeZone { code: string; eicCode: string; name: string; country: string; }
export interface EntsoeImportBody { token: string; zoneCode: string; startDate: string; endDate: string; }
export interface EntsoeImportLog { id: string; year: number; zoneId: string | null; rowsAdded: number; status: string; message: string | null; startedAt: string; endedAt: string; createdAt: string; }

export interface GecColMap {
  hour?:        string;
  consumption?: string;
  production?:  string;
  consUnit?:    string;  // "Wh" | "kWh" | "MWh" | "GWh"
  prodUnit?:    string;
}
export interface GecColumnsResult {
  columns:      string[];
  preview:      Record<string, string>[];
  suggestedMap: GecColMap;
}

export interface GecMonthlyPoint {
  month: number; monthName: string;
  consumptionKwh: number; productionKwh: number;
  tco2: number; avgEfGco2Kwh: number; hours: number;
}
export interface GecCfeResult {
  cfeScore: number;
  totalConsumptionKwh: number; totalProductionKwh: number; totalMatchedKwh: number;
  matchedHours: number; calculatedAt: string;
}
export interface GecResult {
  zoneId: string;
  hasConsumption: boolean; hasProduction: boolean;
  totalConsumptionKwh: number; totalTco2: number;
  avgEfGco2Kwh: number; matchedHours: number; totalRows: number;
  totalProductionKwh: number;
  monthly: GecMonthlyPoint[];
  methodology: string;
  savedToPeriod?: boolean;
  savedCFE?: boolean;
  cfeResult?: GecCfeResult;
}

export interface TenantProfile {
  id: string; name: string; slug: string;
  logoUrl: string | null; brandColor: string | null; timezone: string;
  createdAt: string;
}
export type TenantProfileUpdate = { name?: string; logoUrl?: string | null; brandColor?: string | null; timezone?: string };
// Notification types
export interface NotificationItem {
  id: string; tenantId: string; userId: string;
  type: string; title: string; body: string | null;
  resource: string | null; resourceId: string | null;
  read: boolean; createdAt: string;
}
export interface NotificationList { notifications: NotificationItem[]; unreadCount: number; }
export interface NotificationPrefs {
  calculationDone: boolean; cfeDone: boolean;
  memberInvited: boolean; periodCreated: boolean;
  emailEnabled: boolean;
}

export interface TenantSubscription {
  plan: string; planName: string; planExpires: string | null;
  limits: { seats: number; installs: number };
  usage:  { seats: number; installs: number };
}

export interface CreateInstallationBody { facilityName: string; operator: string; facilityCountry: string; facilityRef?: string; sector: string; }
export interface UpdatePeriodBody {
  periodName?: string; importCountry?: string; cnCode?: string;
  prodVolumeTonne?: number; scope1DirectTco2?: number; scope1Quality?: string;
  scope1AuditNote?: string; electricityKwh?: number; electricitySource?: string;
  matchingRatePct?: number; gecConnected?: boolean; carbonPriceEur?: number;
}
export interface CreatePeriodBody {
  periodName: string; startDate: string; endDate: string; reportYear: number;
  importCountry: string; cnCode: string; prodVolumeTonne: number;
  scope1DirectTco2: number; scope1Quality: string; scope1AuditNote?: string;
  electricityKwh: number; electricitySource: string;
  baselineEf?: number; renewableEf: number; matchingRatePct: number;
  gecConnected?: boolean; carbonPriceEur?: number;
  scope2Exempt?: boolean;
}
