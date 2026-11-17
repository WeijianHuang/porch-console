import {
  DashboardOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { Button, Card, Form, Input, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

interface LoginForm {
  login: string
  password: string
}

const points = [
  { icon: <SwapOutlined />, text: '多门店一键切换，数据始终按门店隔离' },
  { icon: <DashboardOutlined />, text: '横向队列看板，服务人员在岗状态一目了然' },
  { icon: <SafetyCertificateOutlined />, text: '基于权限的访问控制，操作可追溯' },
]

export default function LoginPage() {
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()

  const onFinish = async (values: LoginForm) => {
    try {
      await login(values.login.trim(), values.password)
      await navigate('/queues', { replace: true })
    } catch (error) {
      message.error((error as Error).message || '登录失败，请稍后重试')
    }
  }

  return (
    <div className="login-screen">
      <section className="login-hero">
        <div className="login-hero-top">
          <span className="brand-mark">P</span>
          <span className="brand-word">
            <strong>Porch</strong>
            <span>CONSOLE</span>
          </span>
        </div>

        <div className="login-hero-main">
          <h1>一个控制台，<br />管好每一间门店。</h1>
          <p>把队列、服务人员与门店配置放在同一个工作区。切换门店后，视图与数据同步更新，互不串店。</p>
          <div className="login-points">
            {points.map((point) => (
              <div className="login-point" key={point.text}>
                <span className="point-icon">{point.icon}</span>
                {point.text}
              </div>
            ))}
          </div>
        </div>

        <div className="login-hero-foot">PORCH CONSOLE · 门店运营工作台</div>
      </section>

      <section className="login-pane">
        <Card className="login-card">
          <div className="login-form-head">
            <span className="login-kicker">Welcome back</span>
            <h2>登录工作台</h2>
            <p>请使用门店账号继续</p>
          </div>
          <Form<LoginForm> layout="vertical" onFinish={(values) => void onFinish(values)}>
            <Form.Item label="账号" name="login" rules={[{ required: true, message: '请输入账号' }]}>
              <Input autoComplete="username" placeholder="请输入账号" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password autoComplete="current-password" placeholder="请输入密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block className="login-submit">
              登录
            </Button>
          </Form>
          <div className="login-footnote">登录即表示你同意在工作台内按授权范围访问门店数据</div>
        </Card>
      </section>
    </div>
  )
}
