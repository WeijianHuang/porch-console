import type { ReactNode } from 'react'
import { Alert, Button, Empty, Spin } from 'antd'
import type { ApiError } from '../api/errors'

export function PageLoading() {
  return (
    <div className="state-block">
      <Spin description="加载中…" />
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const detail = error as Partial<ApiError> | undefined
  return (
    <div className="state-block">
      <div className="state-panel">
        <Alert
          type="error"
          showIcon
          title={detail?.message ?? '加载失败'}
          description={
            <div>
              {detail?.code ? <span className="muted">错误码：{detail.code}</span> : null}
              {onRetry ? (
                <Button size="small" type="link" onClick={onRetry}>
                  重试
                </Button>
              ) : null}
            </div>
          }
        />
      </div>
    </div>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="state-block">
      <div className="state-panel">
        <Empty description={children} />
      </div>
    </div>
  )
}
