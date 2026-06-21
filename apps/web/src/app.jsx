import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth.jsx";
import { DashboardLayout } from "./components/DashboardLayout.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { OverviewPage } from "./pages/OverviewPage.jsx";
import { RankingPage } from "./pages/RankingPage.jsx";
import { HistoryPage } from "./pages/HistoryPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";
import { ChangelogPage } from "./pages/ChangelogPage.jsx";
import { FeedbackPage } from "./pages/FeedbackPage.jsx";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="ranking" element={<RankingPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="changelog" element={<ChangelogPage />} />
            <Route path="feedback" element={<FeedbackPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}
