import { Button, Layout, Menu, Typography } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import ShopSwitcher from './ShopSwitcher'

const { Header, Sider, Content } = Layout

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const me = useAuthStore((state) => state.me)
  const logout = useAuthStore((state) => state.logout)

  const selected =
    location.pathname.startsWith('/shops') ? '/shops' : location.pathname.startsWith('/catalog') ? '/catalog' : '/shops'

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="brand">Porch Console</div>
        <ShopSwitcher />
        <div className="header-spacer" />
        <Typography.Text type="secondary">{me?.login ?? '—'}</Typography.Text>
        <Button
          size="small"
          onClick={() => {
            void logout().then(() => navigate('/login', { replace: true }))
          }}
        >
          退出登录
        </Button>
      </Header>
      <Layout>
        <Sider theme="light" width={200}>
          <Menu
            mode="inline"
            selectedKeys={[selected]}
            items={[
              { key: '/shops', label: '门店列表' },
              { key: '/catalog', label: '商品目录' },
            ]}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
