import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="state-block">
      <div className="state-panel">
        <Result
          status="404"
          title="页面不存在"
          subTitle="该视图不在控制台范围内。"
          extra={
            <Button type="primary" onClick={() => navigate('/queues')}>
              返回队列看板
            </Button>
          }
        />
      </div>
    </div>
  )
}
