import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Spin } from 'antd'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import AuditPage from './pages/AuditPage'
import BoardPage from './pages/BoardPage'
import CardsPage from './pages/CardsPage'
import CatalogPage from './pages/CatalogPage'
import LinkagePage from './pages/LinkagePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import OrdersPage from './pages/OrdersPage'
import QueuesPage from './pages/QueuesPage'
import RoomsPage from './pages/RoomsPage'
import RulesPage from './pages/RulesPage'
import ShopSettingsPage from './pages/ShopSettingsPage'
import ShopsPage from './pages/ShopsPage'
import StaffPage from './pages/StaffPage'
import { useAuthStore } from './stores/authStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 10_000 },
  },
})

function Protected({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status)
  return status === 'authenticated' ? <>{children}</> : <Navigate to="/login" replace />
}

function Guest({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status)
  // Queues are the default landing view (ADR-0009).
  return status === 'authenticated' ? <Navigate to="/queues" replace /> : <>{children}</>
}

export default function App() {
  const status = useAuthStore((state) => state.status)
  const bootstrap = useAuthStore((state) => state.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (status === 'loading') {
    return (
      <div className="boot-screen">
        <Spin size="large" description="正在恢复会话…" />
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <Guest>
                <LoginPage />
              </Guest>
            }
          />
          <Route
            element={
              <Protected>
                <AppShell />
              </Protected>
            }
          >
            <Route path="/queues" element={<QueuesPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/linkage" element={<LinkagePage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/shops" element={<ShopsPage />} />
            <Route path="/shops/:shopId/settings" element={<ShopSettingsPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/orders" element={<OrdersPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/queues" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
