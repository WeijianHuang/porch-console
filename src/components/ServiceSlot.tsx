/**
 * Square service slot shared by the dispatch board and the queue matrix
 * (porch-os ADR-0017 / design/14). Four stacked lines: name, state, remaining
 * minutes (reserved until the order domain lands) and the ID card name.
 *
 * The slot is presentational: the caller supplies the visual state and any
 * controls rendered on top. No data fetching here.
 */
import type { ReactNode } from 'react'
import type { CardRef } from '../api/types'
import { stateLabel } from '../shop/staffStatus'

interface ServiceSlotProps {
  name: string
  code?: string
  state: string
  position: number
  duty?: string
  idCard?: CardRef | null
  remainingMinutes?: number | null
  bucket?: string
  primary?: boolean
  pinned?: boolean
  corner?: ReactNode
  actions?: ReactNode
  compact?: boolean
}

export default function ServiceSlot({
  name, code, state, position, duty, idCard, remainingMinutes,
  bucket, primary, pinned, corner, actions, compact,
}: ServiceSlotProps) {
  const remaining = remainingMinutes == null
    ? '—'
    : `${remainingMinutes} 分钟`
  return (
    <div
      className={`service-slot${compact ? ' is-compact' : ''}`}
      data-bucket={bucket}
      data-primary={primary ? 'true' : undefined}
      data-pinned={pinned ? 'true' : undefined}
    >
      <div className="slot-head">
        <span className="slot-pos">{position}</span>
        <span className="slot-head-right">{corner}{actions}</span>
      </div>
      <div className="slot-name" title={name}>{name}</div>
      <div className="slot-state">
        <span className="slot-state-pill">{stateLabel(state)}</span>
        {duty === 'off' ? <span className="slot-off">离岗</span> : null}
      </div>
      <div
        className="slot-remaining"
        title={remainingMinutes == null ? '服务时长来自订单，暂未接入' : `剩余 ${remainingMinutes} 分钟`}
      >
        <span className="slot-line-label">剩余</span>
        <strong>{remaining}</strong>
      </div>
      <div className="slot-card" title={idCard ? `${idCard.name} · ${idCard.code}` : '未绑定 ID 卡'}>
        <span className="slot-line-label">ID 卡</span>
        <span className={idCard ? 'slot-card-name' : 'slot-card-empty'}>
          {idCard ? idCard.name : '未绑卡'}
        </span>
      </div>
      {code ? <span className="slot-code">{code}</span> : null}
    </div>
  )
}
