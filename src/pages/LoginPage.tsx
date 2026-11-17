import { Button, Card, Form, Input, Typography, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

interface LoginForm {
  login: string
  password: string
}

export default function LoginPage() {
  const login = useAuthStore((state) => state.login)
  const navigate = useNavigate()

  const onFinish = async (values: LoginForm) => {
    try {
      await login(values.login.trim(), values.password)
      await navigate('/shops', { replace: true })
    } catch (error) {
      message.error((error as Error).message || '登录失败，请稍后重试')
    }
  }

  return (
    <div className="login-screen">
      <Card className="login-card" title={<Typography.Title level={3}>Porch Console</Typography.Title>}>
        <Typography.Paragraph type="secondary">
          一个控制台，管全部门店。请使用门店账号登录。
        </Typography.Paragraph>
        <Form<LoginForm> layout="vertical" onFinish={(values) => void onFinish(values)}>
          <Form.Item label="账号" name="login" rules={[{ required: true, message: '请输入账号' }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
