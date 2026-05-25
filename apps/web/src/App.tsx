import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import { api } from "./lib/api.js";
import AppShell       from "./components/AppShell.js";
import AdminShell     from "./components/AdminShell.js";
import PageSkeleton   from "./components/PageSkeleton.js";
import LoginPage      from "./pages/LoginPage.js";
import OnboardingPage from "./pages/OnboardingPage.js";
import SharePage      from "./pages/SharePage.js";
import InvitePage     from "./pages/InvitePage.js";

// Code-split — each page is a separate async chunk
const DashboardPage          = lazy(() => import("./pages/DashboardPage.js"));
const GecPage                = lazy(() => import("./pages/GecPage.js"));
const CbamPage               = lazy(() => import("./pages/CbamPage.js"));
const CfePage                = lazy(() => import("./pages/CfePage.js"));
const CfeMatchingPage        = lazy(() => import("./pages/CfeMatchingPage.js"));
const CfeDataEntryPage       = lazy(() => import("./pages/CfeDataEntryPage.js"));
const CfeCertificatesPage    = lazy(() => import("./pages/CfeCertificatesPage.js"));
const CfeFacilitiesPage      = lazy(() => import("./pages/CfeFacilitiesPage.js"));
const CfeGreenAssetsPage     = lazy(() => import("./pages/CfeGreenAssetsPage.js"));
const IntegrationsPage       = lazy(() => import("./pages/IntegrationsPage.js"));
const EfDataPage             = lazy(() => import("./pages/EfDataPage.js"));
const CbamReportPage         = lazy(() => import("./pages/CbamReportPage.js"));
const CdpReportPage          = lazy(() => import("./pages/CdpReportPage.js"));
const Iso14064Page           = lazy(() => import("./pages/Iso14064Page.js"));
const GhgProtocolPage        = lazy(() => import("./pages/GhgProtocolPage.js"));
const InstallationDetailPage = lazy(() => import("./pages/InstallationDetailPage.js"));
const PeriodDetailPage       = lazy(() => import("./pages/PeriodDetailPage.js"));
const SettingsPage           = lazy(() => import("./pages/SettingsPage.js"));
const ProfilePage            = lazy(() => import("./pages/ProfilePage.js"));
const ApiPlaygroundPage      = lazy(() => import("./pages/ApiPlaygroundPage.js"));
const CarbonPricePage        = lazy(() => import("./pages/CarbonPricePage.js"));
const ComparisonPage         = lazy(() => import("./pages/ComparisonPage.js"));
const EmissionTargetsPage    = lazy(() => import("./pages/EmissionTargetsPage.js"));
const ImportWizardPage       = lazy(() => import("./pages/ImportWizardPage.js"));
const BenchmarkPage          = lazy(() => import("./pages/BenchmarkPage.js"));
const CsrdReportPage         = lazy(() => import("./pages/CsrdReportPage.js"));
const CbamWizardPage         = lazy(() => import("./pages/CbamWizardPage.js"));
const CbamFacilityPage       = lazy(() => import("./pages/CbamFacilityPage.js"));
const CbamProductPage        = lazy(() => import("./pages/CbamProductPage.js"));
const EfZonesPage            = lazy(() => import("./pages/EfZonesPage.js"));
const EfCoveragePage         = lazy(() => import("./pages/EfCoveragePage.js"));
const EfApiPage              = lazy(() => import("./pages/EfApiPage.js"));
const LiveForecastHubPage    = lazy(() => import("./pages/LiveForecastHubPage.js"));
const EsgPlaygroundPage      = lazy(() => import("./pages/EsgPlaygroundPage.js"));

// Admin pages (super-admin only)
const AdminDashboardPage   = lazy(() => import("./pages/admin/AdminDashboardPage.js"));
const AdminTenantsPage     = lazy(() => import("./pages/admin/AdminTenantsPage.js"));
const AdminUsersPage       = lazy(() => import("./pages/admin/AdminUsersPage.js"));
const AdminEfDataPage      = lazy(() => import("./pages/admin/AdminEfDataPage.js"));
const AdminAnnouncementsPage = lazy(() => import("./pages/admin/AdminAnnouncementsPage.js"));
const AdminWebhooksPage    = lazy(() => import("./pages/admin/AdminWebhooksPage.js"));
const AdminApiPage         = lazy(() => import("./pages/admin/AdminApiPage.js"));
const AdminSmtpPage        = lazy(() => import("./pages/admin/AdminSmtpPage.js"));

function AppLayout() {
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

function AdminLayout() {
  return (
    <AdminShell>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </AdminShell>
  );
}

function AppRouter() {
  const { session, loading } = useAuth();
  const [onboarded, setOnboarded]       = useState<boolean | null>(null);
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) { setOnboarded(null); setOnboardError(null); return; }
    setOnboardLoading(true);
    setOnboardError(null);
    api.onboarding.me()
      .then(data => {
        setOnboarded(data.onboarded);
      })
      .catch((err: unknown) => {
        const status = (err as { status?: number })?.status;
        // 401/403 → session geçersiz → oturumu kapat, login sayfasına yönlendir
        if (status === 401 || status === 403) {
          import("./lib/supabase.js").then(({ supabase }) => supabase.auth.signOut());
          setOnboarded(null); // flash önle — login sayfası session null olunca açılır
          return;
        }
        // Gerçek API hatası → yeniden dene sayfası göster
        setOnboardError("Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin.");
      })
      .finally(() => setOnboardLoading(false));
  }, [session]);

  if (loading || onboardLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#5c7a72" }}>
        Yükleniyor...
      </div>
    );
  }

  if (onboardError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 12, color: "#1e293b" }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>⚠️ Bağlantı hatası</div>
        <div style={{ fontSize: 14, color: "#64748b" }}>{onboardError}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#10b981", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 }}
        >
          Yenile
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/share/:token"  element={<SharePage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="*"              element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    );
  }

  if (onboarded === false) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<OnboardingPage />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no AppShell */}
        <Route path="/share/:token" element={<SharePage />} />

        {/* Admin routes — wrapped in AdminShell (super-admin guard inside) */}
        <Route element={<AdminLayout />}>
          <Route path="/admin"                  element={<AdminDashboardPage />} />
          <Route path="/admin/tenants"          element={<AdminTenantsPage />} />
          <Route path="/admin/users"            element={<AdminUsersPage />} />
          <Route path="/admin/ef-data"          element={<AdminEfDataPage />} />
          <Route path="/admin/announcements"    element={<AdminAnnouncementsPage />} />
          <Route path="/admin/webhooks"         element={<AdminWebhooksPage />} />
          <Route path="/admin/api"              element={<AdminApiPage />} />
          <Route path="/admin/smtp"             element={<AdminSmtpPage />} />
        </Route>

        {/* Authenticated routes — wrapped in AppShell + Suspense */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/gec"                                               element={<GecPage />} />
          <Route path="/dashboard"                                         element={<DashboardPage />} />
          <Route path="/cbam"                                              element={<CbamPage />} />
          <Route path="/cfe"                                               element={<CfePage />} />
          <Route path="/cfe/matching"                                      element={<CfeMatchingPage />} />
          <Route path="/cfe/data-entry"                                    element={<CfeDataEntryPage />} />
          <Route path="/cfe/certificates"                                  element={<CfeCertificatesPage />} />
          <Route path="/cfe/facilities"                                   element={<CfeFacilitiesPage />} />
          <Route path="/cfe/green-assets"                                 element={<CfeGreenAssetsPage />} />
          <Route path="/integrations"                                     element={<IntegrationsPage />} />
          <Route path="/ef-data"                                           element={<EfDataPage />} />
          <Route path="/ef-data/zones"                                     element={<EfZonesPage />} />
          <Route path="/ef-data/coverage"                                  element={<EfCoveragePage />} />
          <Route path="/ef-data/api"                                       element={<EfApiPage />} />
          <Route path="/reports/cbam"                                      element={<CbamReportPage />} />
          <Route path="/reports/cdp"                                       element={<CdpReportPage />} />
          <Route path="/reports/iso14064"                                  element={<Iso14064Page />} />
          <Route path="/reports/ghg"                                       element={<GhgProtocolPage />} />
          <Route path="/settings"                                          element={<SettingsPage />} />
          <Route path="/profile"                                           element={<ProfilePage />} />
          <Route path="/api-playground"                                    element={<ApiPlaygroundPage />} />
          <Route path="/carbon-prices"                                     element={<CarbonPricePage />} />
          <Route path="/comparison"                                        element={<ComparisonPage />} />
          <Route path="/emission-targets"                                  element={<EmissionTargetsPage />} />
          <Route path="/import"                                            element={<ImportWizardPage />} />
          <Route path="/benchmark"                                         element={<BenchmarkPage />} />
          <Route path="/csrd"                                              element={<CsrdReportPage />} />
          <Route path="/installations/:id"                                    element={<InstallationDetailPage />} />
          <Route path="/installations/:installationId/periods/:periodId"    element={<PeriodDetailPage />} />
          <Route path="/cbam/wizard"                                          element={<CbamWizardPage />} />
          <Route path="/cbam/facilities/:facilityId"                        element={<CbamFacilityPage />} />
          <Route path="/cbam/facilities/:facilityId/products/:productId"    element={<CbamProductPage />} />
          <Route path="/live-forecast/*"                                    element={<LiveForecastHubPage />} />
          <Route path="/esg-playground"                                    element={<EsgPlaygroundPage />} />
          <Route path="/esg-playground/:graphId"                           element={<EsgPlaygroundPage />} />
          <Route path="*"                                                  element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return <AppRouter />;
}
