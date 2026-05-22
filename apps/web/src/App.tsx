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

// Admin pages (super-admin only)
const AdminDashboardPage   = lazy(() => import("./pages/admin/AdminDashboardPage.js"));
const AdminTenantsPage     = lazy(() => import("./pages/admin/AdminTenantsPage.js"));
const AdminUsersPage       = lazy(() => import("./pages/admin/AdminUsersPage.js"));
const AdminEfDataPage      = lazy(() => import("./pages/admin/AdminEfDataPage.js"));
const AdminAnnouncementsPage = lazy(() => import("./pages/admin/AdminAnnouncementsPage.js"));
const AdminWebhooksPage    = lazy(() => import("./pages/admin/AdminWebhooksPage.js"));

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
  const [onboarded, setOnboarded]     = useState<boolean | null>(null);
  const [onboardLoading, setOnboardLoading] = useState(false);

  useEffect(() => {
    if (!session) { setOnboarded(null); return; }
    setOnboardLoading(true);
    api.onboarding.me()
      .then(data => setOnboarded(data.onboarded))
      .catch(() => setOnboarded(false))
      .finally(() => setOnboardLoading(false));
  }, [session]);

  if (loading || onboardLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#5c7a72" }}>
        Yükleniyor...
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
        </Route>

        {/* Authenticated routes — wrapped in AppShell + Suspense */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/gec" replace />} />
          <Route path="/gec"                                               element={<GecPage />} />
          <Route path="/dashboard"                                         element={<DashboardPage />} />
          <Route path="/cbam"                                              element={<CbamPage />} />
          <Route path="/cfe"                                               element={<CfePage />} />
          <Route path="/ef-data"                                           element={<EfDataPage />} />
          <Route path="/reports/cbam"                                      element={<CbamReportPage />} />
          <Route path="/reports/cdp"                                       element={<CdpReportPage />} />
          <Route path="/reports/iso14064"                                  element={<Iso14064Page />} />
          <Route path="/reports/ghg"                                       element={<GhgProtocolPage />} />
          <Route path="/settings"                                          element={<SettingsPage />} />
          <Route path="/profile"                                           element={<ProfilePage />} />
          <Route path="/api-playground"                                    element={<ApiPlaygroundPage />} />
          <Route path="/carbon-prices"                                     element={<CarbonPricePage />} />
          <Route path="/installations/:id"                                 element={<InstallationDetailPage />} />
          <Route path="/installations/:installationId/periods/:periodId"   element={<PeriodDetailPage />} />
          <Route path="*"                                                  element={<Navigate to="/gec" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return <AppRouter />;
}
