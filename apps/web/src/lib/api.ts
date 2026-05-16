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
    list: () => request<Installation[]>("GET", "/installations"),
    get:  (id: string) => request<InstallationDetail>("GET", `/installations/${id}`),
    create: (body: CreateInstallationBody) =>
      request<Installation>("POST", "/installations", body),
    delete: (id: string) => request<void>("DELETE", `/installations/${id}`),
  },

  periods: {
    create: (installationId: string, body: CreatePeriodBody) =>
      request<Period>("POST", `/installations/${installationId}/periods`, body),
    calculate: (installationId: string, periodId: string) =>
      request<CalculationResult>("POST", `/installations/${installationId}/periods/${periodId}/calculate`),
    getResult: (installationId: string, periodId: string) =>
      request<EmbeddedEmission>("GET", `/installations/${installationId}/periods/${periodId}/result`),
    reportUrl: (installationId: string, periodId: string) =>
      `${BASE}/installations/${installationId}/periods/${periodId}/report`,
    delete: (installationId: string, periodId: string) =>
      request<void>("DELETE", `/installations/${installationId}/periods/${periodId}`),
  },

  cfe: {
    submit: (installationId: string, periodId: string, body: CFEBody) =>
      request<CFEResult>("POST", `/installations/${installationId}/periods/${periodId}/cfe`, body),
    get: (installationId: string, periodId: string) =>
      request<CFEResult>("GET", `/installations/${installationId}/periods/${periodId}/cfe`),
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
    update: (userId: string, role: string) => request("PATCH", `/members/${userId}`, { role }),
    remove: (userId: string) => request<void>("DELETE", `/members/${userId}`),
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

  onboarding: {
    me:     () => request<OnboardingMe>("GET", "/onboarding/me"),
    createTenant: (companyName: string) =>
      request<OnboardingResult>("POST", "/onboarding/tenant", { companyName }),
  },

  shareLinks: {
    create: (installationId: string, periodId: string, ttlDays?: number) =>
      request<ShareLinkResult>("POST", "/share-links", { installationId, periodId, ttlDays }),
    revoke: (jti: string) => request<void>("DELETE", `/share-links/${jti}`),
  },

  share: {
    get: (token: string) =>
      fetch(`${BASE}/share/${token}`).then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw Object.assign(new Error(err.error ?? "Geçersiz bağlantı"), { status: res.status, body: err });
        }
        return res.json() as Promise<ShareViewResult>;
      }),
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Installation {
  id: string; tenantId: string; facilityName: string;
  operator: string; facilityCountry: string; facilityRef: string | null;
  createdAt: string; updatedAt: string;
  _count?: { periods: number };
}

export interface Period {
  id: string; installationId: string; periodName: string;
  startDate: string; endDate: string; reportYear: number;
  importCountry: string; cnCode: string; prodVolumeTonne: number;
  scope1DirectTco2: number; scope1Quality: string;
  electricityKwh: number; baselineEf: number; renewableEf: number;
  matchingRatePct: number; gecConnected: boolean; carbonPriceEur: number | null;
  createdAt: string; result?: EmbeddedEmission;
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
export interface ShareLinkResult { token: string; expiresAt: string; }
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

export interface CsvImportResult {
  rowCount: number; errorCount: number; errors: string[];
  result: { cfeScore: number; totalConsumptionKwh: number; totalMatchedKwh: number };
}
export interface EFEntry { iso2: string; name: string; ef: number; source: string; year: number; dataVersion: string; notes?: string; }
export interface EFListResult { dataVersion: string; countries: Array<{ iso2: string; name: string; ef: number }>; }

export interface CreateInstallationBody { facilityName: string; operator: string; facilityCountry: string; facilityRef?: string; sector: string; }
export interface CreatePeriodBody {
  periodName: string; startDate: string; endDate: string; reportYear: number;
  importCountry: string; cnCode: string; prodVolumeTonne: number;
  scope1DirectTco2: number; scope1Quality: string; scope1AuditNote?: string;
  electricityKwh: number; electricitySource: string;
  baselineEf?: number; renewableEf: number; matchingRatePct: number;
  gecConnected?: boolean; carbonPriceEur?: number;
  scope2Exempt?: boolean;
}
