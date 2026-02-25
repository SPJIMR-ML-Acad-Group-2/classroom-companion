import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import HomePage from "./pages/HomePage";
import Dashboard from "./pages/Dashboard";
import RequestAccess from "./pages/RequestAccess";
import RequestHistory from "./pages/RequestHistory";
import ManageBatch from "./pages/ManageBatch";
import OnboardBatch from "./pages/OnboardBatch";
import BatchDivisionsPage from "./pages/BatchDivisionsPage";
import BatchStudentsPage from "./pages/BatchStudentsPage";
import BatchAcadGroupsPage from "./pages/BatchAcadGroupsPage";
import ManageDivisionsPage from "./pages/ManageDivisionsPage";
import ManageAcadGroupsPage from "./pages/ManageAcadGroupsPage";
import ManageCourses from "./pages/ManageCourses";
import SystemSettings from "./pages/SystemSettings";
import TimetablePage from "./pages/TimetablePage";
import AttendanceHubPage from "./pages/AttendanceHubPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModuleRouteGuard from "./components/ModuleRouteGuard";

const queryClient = new QueryClient();

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
            <pre className="p-4 bg-muted rounded-md text-left text-xs overflow-auto max-h-60 whitespace-pre-wrap break-words">
              {this.state.error?.message}
            </pre>
            <Button onClick={() => window.location.reload()}>Reload Page</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route
                path="/"
                element={
                  <PublicOnlyRoute>
                    <HomePage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/request-access"
                element={
                  <ProtectedRoute>
                    <RequestAccess />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/request-history"
                element={
                  <ProtectedRoute>
                    <RequestHistory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/managebatch"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="manage_batch">
                      <ManageBatch />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/onboardbatch"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="onboard_batch">
                      <OnboardBatch />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/managebatch/divisions"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="manage_batch" subtileKey="manage_divisions">
                      <BatchDivisionsPage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/managebatch/students"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="manage_batch" subtileKey="manage_students">
                      <BatchStudentsPage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/managebatch/acad-groups"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="manage_batch" subtileKey="manage_acad_groups">
                      <BatchAcadGroupsPage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/managebatch/manage-divisions"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="manage_batch" subtileKey="manage_divisions">
                      <ManageDivisionsPage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/managebatch/manage-acad-groups"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="manage_batch" subtileKey="manage_acad_groups">
                      <ManageAcadGroupsPage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses"
                element={
                  <ProtectedRoute>
                    <ManageCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="attendance_hub">
                      <AttendanceHubPage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance/upload"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="attendance_hub" subtileKey="upload_attendance">
                      <AttendanceHubPage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance/view"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="attendance_hub" subtileKey="view_attendance">
                      <AttendanceHubPage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance/reports"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="attendance_hub" subtileKey="attendance_reports">
                      <AttendanceHubPage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/timetable"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="timetable">
                      <TimetablePage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/timetable/publish"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="timetable" subtileKey="publish_timetable">
                      <TimetablePage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/timetable/view"
                element={
                  <ProtectedRoute>
                    <ModuleRouteGuard tileKey="timetable" subtileKey="view_timetable">
                      <TimetablePage />
                    </ModuleRouteGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SystemSettings />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
