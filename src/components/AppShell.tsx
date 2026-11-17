import { useState } from 'react'
import { Avatar, Button, Dropdown, Layout, Menu, Tooltip } from 'antd'
import {
  AppstoreOutlined,
  CalendarOutlined,
  DownOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ShopOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import ShopSwitcher from './ShopSwitcher'

const { Header, Sider, Content } = Layout

const navItems = [
  { key: '/queues', label: '队列看板', icon: <CalendarOutlined /> },
  { key: '/staff', label: '服务人员', icon: <TeamOutlined /> },
  { key: '/shops', label: '门店列表', icon: <ShopOutlined /> },
  { key: '/catalog', label: '商品目录', icon: <AppstoreOutlined /> },
]

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const me = useAuthStore((state) => state.me)
  const logout = useAuthStore((state) => state.logout)

  const selected = location.pathname.startsWith('/shops')
    ? '/shops'
    : location.pathname.startsWith('/catalog')
      ? '/catalog'
      : location.pathname.startsWith('/staff')
        ? '/staff'
        : '/queues'

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
          队列 · 人员 · 门店 · 目录
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
            <span className="header-eyebrow">当前工作区</span>
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
