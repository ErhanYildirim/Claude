// Multi-tenant middleware — her request'te X-Tenant-ID doğrular
// Tenant isolation: tüm DB sorguları bu middleware sonrası tenantId ile filtrelenir

export interface TenantContext {
  tenantId: string;
}

export class TenantIsolationError extends Error {
  constructor() {
    super("Cross-tenant access denied.");
    this.name = "TenantIsolationError";
  }
}

export function extractTenantId(headers: Record<string, string | undefined>): string {
  const tenantId = headers["x-tenant-id"];
  if (!tenantId || !isValidUuid(tenantId)) {
    throw new Error("X-Tenant-ID header eksik veya geçersiz UUID.");
  }
  return tenantId;
}

// Her DB sonucunun sahibini doğrula — cross-tenant sızıntısını engeller
export function assertTenantOwnership(
  resourceTenantId: string,
  requestTenantId: string,
): void {
  if (resourceTenantId !== requestTenantId) {
    throw new TenantIsolationError();
  }
}

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
