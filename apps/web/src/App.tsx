import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
import { api } from "./lib/api.js";
import LoginPage            from "./pages/LoginPage.js";
import OnboardingPage       from "./pages/OnboardingPage.js";
import DashboardPage        from "./pages/DashboardPage.js";
import InstallationDetailPage from "./pages/InstallationDetailPage.js";
import PeriodDetailPage     from "./pages/PeriodDetailPage.js";
import SharePage            from "./pages/SharePage.js";
import SettingsPage         from "./pages/SettingsPage.js";

function AppRouter() {
  const { session, loading } = useAuth();
  const [onboarded, setOnboarded]   = useState<boolean | null>(null);
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#6B7280" }}>
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
        <Route path="/"                                                element={<DashboardPage />} />
        <Route path="/installations/:id"                               element={<InstallationDetailPage />} />
        <Route path="/installations/:installationId/periods/:periodId" element={<PeriodDetailPage />} />
        <Route path="/settings"                                        element={<SettingsPage />} />
        <Route path="/share/:token"                                    element={<SharePage />} />
        <Route path="*"                                                element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return <AppRouter />;
}
