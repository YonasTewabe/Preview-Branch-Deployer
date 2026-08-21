import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { App as AntdApp } from 'antd';
import { ErrorBoundary } from './pages/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import NodeConfigPage from './pages/NodeConfigPage';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';
import MyProjects from './components/Projects/MyProjects';
import ProjectDetail from './components/Projects/ProjectDetail';
import ProjectEnvironments from './components/Projects/ProjectEnvironments';
import EnvManagement from './pages/EnvManagement';
import SystemSettings from './pages/SystemSettings';
import Trash from "./pages/Trash";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    // <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AntdApp>
          <AuthProvider>
            <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/change-password" element={<ChangePassword />} />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Dashboard />
                    </MainLayout>
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/projects/:projectId/nodes/:nodeId"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <NodeConfigPage />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/projects" 
              >
                <Route 
                index
                element={
                  <ProtectedRoute>
                    <MainLayout>
                    <MyProjects />
                    </MainLayout>
                  </ProtectedRoute>
                } 
              />
                <Route path="/projects/:id" element={ <ProtectedRoute>
                  <MainLayout><ProjectDetail /></MainLayout>
                  </ProtectedRoute>} />
                <Route path="/projects/:id/environments" element={ <ProtectedRoute>
                  <MainLayout><ProjectEnvironments /></MainLayout>
                  </ProtectedRoute>} />
              </Route>
              <Route
                path="/environments"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <EnvManagement />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/users" 
                element={
                  <ProtectedRoute adminOnly={true}>
                    <MainLayout>
                      <UserManagement />
                    </MainLayout>
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Profile />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <MainLayout>
                      <SystemSettings />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trash"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Trash />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
          {import.meta.env.DEV ? (
            <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
          ) : null}
        </AuthProvider>
        </AntdApp>
      </QueryClientProvider>
    // </ErrorBoundary>
  );
}

export default App;
