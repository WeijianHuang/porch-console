import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="state-block">
      <Result
        status="404"
        title="页面不存在"
        subTitle="该视图不在控制台范围内。"
        extra={
          <Button type="primary" onClick={() => navigate('/shops')}>
            返回门店列表
          </Button>
        }
      />
    </div>
  )
}
