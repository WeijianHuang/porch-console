import { useState } from 'react'
import { Avatar, Button, Dropdown, Layout, Menu, Tooltip } from 'antd'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  DollarOutlined,
  DownOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import ShopSwitcher from './ShopSwitcher'

const { Header, Sider, Content } = Layout

const navItems = [
  { key: '/home', label: '首页', icon: <HomeOutlined /> },
  { key: '/queues', label: '队列看板', icon: <CalendarOutlined /> },
  { key: '/staff', label: '服务人员', icon: <TeamOutlined /> },
  { key: '/shift-templates', label: '班次管理', icon: <ClockCircleOutlined /> },
  { key: '/rooms', label: '房间管理', icon: <ApartmentOutlined /> },
  { key: '/cards', label: 'ID 卡管理', icon: <CreditCardOutlined /> },
  { key: '/board', label: '调度看板', icon: <DashboardOutlined /> },
  { key: '/rules', label: '判定链配置', icon: <SettingOutlined /> },
  { key: '/linkage', label: '联动策略', icon: <AppstoreOutlined /> },
  { key: '/audit', label: '审计与指标', icon: <AuditOutlined /> },
  { key: '/shops', label: '门店列表', icon: <ShopOutlined /> },
  { key: '/catalog', label: '商品目录', icon: <AppstoreOutlined /> },
  { key: '/orders', label: '订单列表', icon: <DollarOutlined /> },
]

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const me = useAuthStore((state) => state.me)
  const logout = useAuthStore((state) => state.logout)

  // Longest matching route wins so /shops/:id/settings maps to /shops, etc.
  const selected = [...navItems]
    .map((item) => item.key)
    .filter((key) => location.pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0] ?? '/home'

  const today = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const doLogout = () => {
    void logout().then(() => navigate('/login', { replace: true }))
  }

  return (
    <Layout className="app-shell">
      <Sider
        className="app-sider"
        theme="dark"
        width={228}
        collapsedWidth={0}
        breakpoint="lg"
        collapsed={collapsed}
        onBreakpoint={setCollapsed}
        // AntD renders a floating zero-width trigger that overlaps the page
        // title when collapsed. The header nav-toggle is the single control.
        trigger={null}
      >
        <div className="sider-brand">
          <span className="brand-mark">P</span>
          <span className="brand-word">
            <strong>Porch</strong>
            <span>CONSOLE</span>
          </span>
        </div>
        <div className="sider-caption">工作台</div>
        <Menu
          className="side-menu"
          mode="inline"
          theme="dark"
          selectedKeys={[selected]}
          items={navItems}
          onClick={({ key }) => navigate(key)}
        />
        <div className="sider-spacer" />
        <div className="sider-foot">
          <strong>运营工作台</strong>
          队列 · 人员 · 房间 · 门店 · 目录
          <br />
          统一视图，按门店隔离
        </div>
      </Sider>

      <Layout className="app-main">
        <Header className="app-header">
          <Tooltip title={collapsed ? '展开导航' : '收起导航'}>
            <Button
              type="text"
              className="nav-toggle"
              aria-label={collapsed ? '展开导航' : '收起导航'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
          </Tooltip>
          <div className="header-context">
            <span className="header-eyebrow">当前门店</span>
            <ShopSwitcher />
          </div>
          <div className="header-spacer" />
          <span className="header-clock">{today}</span>
          <span className="header-divider" />
          <Dropdown
            menu={{
              items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录' }],
              onClick: ({ key }) => {
                if (key === 'logout') doLogout()
              },
            }}
            placement="bottomRight"
          >
            <button type="button" className="user-chip" aria-label="账号菜单">
              <Avatar size={28} icon={<UserOutlined />} style={{ backgroundColor: '#2f7d5b' }} />
              <span>{me?.login ?? '—'}</span>
              <DownOutlined />
            </button>
          </Dropdown>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
