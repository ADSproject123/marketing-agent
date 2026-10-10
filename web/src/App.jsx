import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardLayout from "./pages/dashboard/DashboardLayout";
import OverviewPage from "./pages/dashboard/OverviewPage";
import ComposePage from "./pages/dashboard/ComposePage";
import PipelinePage from "./pages/dashboard/PipelinePage";
import JobsPage from "./pages/dashboard/JobsPage";
import GuidePage from "./pages/dashboard/GuidePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="compose" element={<ComposePage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="guide" element={<GuidePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
