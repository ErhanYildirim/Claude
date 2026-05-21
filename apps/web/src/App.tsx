import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import { api } from "./lib/api.js";
import AppShell               from "./components/AppShell.js";
import LoginPage              from "./pages/LoginPage.js";
import OnboardingPage         from "./pages/OnboardingPage.js";
import DashboardPage          from "./pages/DashboardPage.js";
import CbamPage               from "./pages/CbamPage.js";
import CfePage                from "./pages/CfePage.js";
import EfDataPage             from "./pages/EfDataPage.js";
import CbamReportPage         from "./pages/CbamReportPage.js";
import CdpReportPage          from "./pages/CdpReportPage.js";
import Iso14064Page           from "./pages/Iso14064Page.js";
import GhgProtocolPage        from "./pages/GhgProtocolPage.js";
import GecPage               from "./pages/GecPage.js";
import InstallationDetailPage from "./pages/InstallationDetailPage.js";
import PeriodDetailPage       from "./pages/PeriodDetailPage.js";
import SharePage              from "./pages/SharePage.js";
import SettingsPage           from "./pages/SettingsPage.js";

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
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
          <Route path="/share/:token" element={<SharePage />} />
          <Route path="*" element={<LoginPage />} />
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

        {/* Authenticated routes — wrapped in AppShell */}
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
