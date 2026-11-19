/** Audit log and observed-only dashboards (ADR-0012 / design/12 §8). */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Segmented, Table, Tag } from 'antd'
import PageHeader from '../components/PageHeader'
import { ErrorState, PageLoading } from '../components/RequestState'
import { schedulingApi } from '../api/scheduling'
import { queryKeys } from '../api/keys'
import { useShopStore } from '../stores/shopStore'
import type { AuditEntry, SchedulingEvent } from '../api/types'
import { formatUTC8 } from '../utils/datetime'

const ACTION_LABEL: Record<string, string> = {
  decision: '决策', pin: '置顶', unpin: '解除置顶', restore: '回原位',
  cancel: '取消', complete: '完成', assignment_method_changed: '指派方式变更',
  config_published: '配置发布', task_cancelled: '任务取消', task_completed: '任务完成',
}

export default function AuditPage() {
  const shopId = useShopStore((s) => s.currentShopId)
  const [tab, setTab] = useState<'audit' | 'metrics'>('audit')
  const auditQ = useQuery({
    queryKey: queryKeys.schedulingAudit(shopId ?? ''),
    queryFn: () => schedulingApi.audit(shopId!),
    enabled: !!shopId && tab === 'audit',
  })
  const eventsQ = useQuery({
    queryKey: queryKeys.schedulingEvents(shopId ?? ''),
    queryFn: () => schedulingApi.events(shopId!),
    enabled: !!shopId && tab === 'metrics',
  })

  const metrics = useMemo(() => {
    const events: SchedulingEvent[] = eventsQ.data?.data ?? []
    const total = events.length
    const rotate = events.filter((e) => e.decision === 'rotate').length
    const byMethod = new Map<string, number>()
    for (const e of events) byMethod.set(e.method, (byMethod.get(e.method) ?? 0) + 1)
    const byRule = new Map<string, number>()
    for (const e of events) if (e.hit_rule) byRule.set(e.hit_rule, (byRule.get(e.hit_rule) ?? 0) + 1)
    return { total, rotate, hold: total - rotate, byMethod, byRule }
  }, [eventsQ.data])

  if (!shopId) return <PageLoading />

  return (
    <div className="page-stack">
      <PageHeader eyebrow="调度引擎" title="审计与指标"
        description="审计流水只追加、不可删除；指标只呈现实测值，不设目标阈值。" />
      <Segmented value={tab} onChange={(v) => setTab(v as typeof tab)}
        options={[{ value: 'audit', label: '审计流水' }, { value: 'metrics', label: '决策指标' }]} />

      {tab === 'audit' ? (
        auditQ.isLoading ? <PageLoading /> : auditQ.isError ? (
          <ErrorState error={auditQ.error} onRetry={() => auditQ.refetch()} />
        ) : (
          <section className="panel">
            <Table<AuditEntry>
              rowKey="public_id"
              size="small"
              dataSource={auditQ.data?.data ?? []}
              pagination={{ pageSize: 12 }}
              columns={[
                { title: '时间', dataIndex: 'created_at', width: 150, render: formatUTC8 },
                { title: '动作', dataIndex: 'action', width: 140, render: (v: string) =>
                  <Tag color={v === 'config_published' ? 'blue' : v === 'restore' ? 'orange' : 'default'}>
                    {ACTION_LABEL[v] ?? v}
                  </Tag> },
                { title: '对象', dataIndex: 'target_type', render: (v: string) => v.replace('scheduling.', '') },
                { title: '事件', dataIndex: 'target_id', render: (v: string) => v || '—' },
                { title: '操作者', dataIndex: 'operator', render: (v: string) => v || '—' },
                { title: '明细', dataIndex: 'payload', render: (v: Record<string, unknown>) =>
                  <code>{JSON.stringify(v)}</code> },
              ]}
            />
          </section>
        )
      ) : (
        eventsQ.isLoading ? <PageLoading /> : eventsQ.isError ? (
          <ErrorState error={eventsQ.error} onRetry={() => eventsQ.refetch()} />
        ) : (
          <div className="metrics-grid">
            <div className="stat-tile">
              <div><strong>{metrics.total}</strong><span>事件总数（实测）</span></div>
            </div>
            <div className="stat-tile">
              <div><strong>{metrics.rotate}</strong><span>轮转次数（实测）</span></div>
            </div>
            <div className="stat-tile">
              <div><strong>{metrics.hold}</strong><span>保持次数（实测）</span></div>
            </div>
            <div className="stat-tile">
              <div><strong>{metrics.total ? ((metrics.rotate / metrics.total) * 100).toFixed(1) : '0.0'}%</strong><span>轮转占比（实测）</span></div>
            </div>
            <section className="panel">
              <div className="panel-head"><h2>指派方式分布</h2></div>
              {[...metrics.byMethod.entries()].map(([k, v]) => (
                <div className="metric-row" key={k}><span>{k}</span><strong>{v}</strong></div>
              ))}
              {metrics.byMethod.size === 0 ? <p className="muted">暂无事件</p> : null}
            </section>
            <section className="panel">
              <div className="panel-head"><h2>规则命中分布</h2></div>
              {[...metrics.byRule.entries()].map(([k, v]) => (
                <div className="metric-row" key={k}><span>{k}</span><strong>{v}</strong></div>
              ))}
              {metrics.byRule.size === 0 ? <p className="muted">暂无命中</p> : null}
            </section>
          </div>
        )
      )}
    </div>
  )
}
