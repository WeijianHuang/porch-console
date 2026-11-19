/** Linkage policy configuration (ADR-0012 / design/12). */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Input, Select, Space, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageHeader from '../components/PageHeader'
import { ErrorState, PageLoading } from '../components/RequestState'
import { schedulingApi } from '../api/scheduling'
import { queryKeys } from '../api/keys'
import { useShopStore } from '../stores/shopStore'
import type { PolicyInput, PropagationMode, QueueAction } from '../api/types'

const MODE_LABEL: Record<PropagationMode, string> = {
  independent: '独立（仅来源队列）', all: '全部联动', same_group: '同组联动',
  allowlist: '名单联动', exclude: '排除联动', frozen: '冻结（不联动）',
}
const ACTION_LABEL: Record<QueueAction, string> = {
  move_to_tail: '移至队尾', restore: '回原位', insert_at: '插入指定位',
  suspend: '挂起', remove: '移出队列',
}

export default function LinkagePage() {
  const shopId = useShopStore((s) => s.currentShopId)
  const qc = useQueryClient()
  const [draft, setDraft] = useState<PolicyInput[]>([])
  const queuesQ = useQuery({
    queryKey: queryKeys.schedulingBoard(shopId ?? ''),
    queryFn: () => schedulingApi.board(shopId!),
    enabled: !!shopId,
  })
  const q = useQuery({
    queryKey: queryKeys.schedulingPolicies(shopId ?? ''),
    queryFn: () => schedulingApi.policies(shopId!),
    enabled: !!shopId,
  })
  useEffect(() => {
    if (q.data?.data) {
      setDraft(q.data.data.map((p) => ({
        primary_queue_id: p.primary_queue_id, mode: p.mode, allowlist: p.allowlist,
        exclude: p.exclude, group: p.group, action_map: p.action_map, insert_at: p.insert_at,
      })))
    }
  }, [q.data])

  const mut = useMutation({
    mutationFn: () => schedulingApi.publishPolicies(shopId!, draft),
    onSuccess: () => {
      message.success('联动策略已发布')
      if (shopId) void qc.invalidateQueries({ queryKey: queryKeys.schedulingPolicies(shopId) })
    },
    onError: (e) => message.error((e as Error).message ?? '发布失败'),
  })

  if (!shopId) return <PageLoading />
  if (q.isLoading) return <PageLoading />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />

  const queueOptions = (queuesQ.data?.data.queues ?? []).map((x) => ({ value: x.public_id, label: `${x.seq} · ${x.name}` }))
  const patch = (i: number, v: Partial<PolicyInput>) =>
    setDraft((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...v } : p)))

  const addPolicy = () => {
    if (queueOptions.length === 0) return
    setDraft((prev) => [...prev, {
      primary_queue_id: queueOptions[0].value, mode: 'independent',
      allowlist: [], exclude: [], group: '', action_map: {}, insert_at: {},
    }])
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="调度引擎"
        title="联动策略"
        description="一次派单按主队列传播到从队列；从队列按自身长度落位，绝不复制主队列位次。"
        actions={<Space>
          <Button icon={<PlusOutlined />} onClick={addPolicy}>新增策略</Button>
          <Button type="primary" loading={mut.isPending} onClick={() => mut.mutate()}>发布</Button>
        </Space>}
      />
      <Alert type="info" showIcon
        message="联动为单向传播，从队列不会触发新一轮；置顶与冻结队列强制保持位次。" />
      {draft.length === 0 ? (
        <div className="panel"><p className="muted">当前站点还没有联动策略，默认仅来源队列参与。</p></div>
      ) : draft.map((p, i) => (
        <section className="panel linkage-panel" key={i}>
          <div className="panel-head">
            <h2>策略 {i + 1}</h2>
            <Button size="small" type="link" danger onClick={() => setDraft((prev) => prev.filter((_, idx) => idx !== i))}>删除</Button>
          </div>
          <div className="form-grid">
            <label>
              <span>主队列</span>
              <Select value={p.primary_queue_id} style={{ width: '100%' }} options={queueOptions}
                onChange={(v) => patch(i, { primary_queue_id: v })} />
            </label>
            <label>
              <span>传播模式</span>
              <Select value={p.mode} style={{ width: '100%' }}
                onChange={(v) => patch(i, { mode: v })}
                options={Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label }))} />
            </label>
            {p.mode === 'allowlist' ? (
              <label>
                <span>参与队列（名单）</span>
                <Select mode="multiple" value={p.allowlist} style={{ width: '100%' }} options={queueOptions}
                  onChange={(v) => patch(i, { allowlist: v })} />
              </label>
            ) : null}
            {p.mode === 'exclude' ? (
              <label>
                <span>排除队列</span>
                <Select mode="multiple" value={p.exclude} style={{ width: '100%' }} options={queueOptions}
                  onChange={(v) => patch(i, { exclude: v })} />
              </label>
            ) : null}
            {p.mode === 'same_group' ? (
              <label>
                <span>分组标识</span>
                <Input value={p.group}
                  onChange={(e) => patch(i, { group: e.target.value })} placeholder="留空则用来源队列分组" />
              </label>
            ) : null}
          </div>
          <div className="panel-head"><h3>逐队列动作</h3><Tag>各自落位</Tag></div>
          <div className="action-map">
            {(queuesQ.data?.data.queues ?? []).map((q) => (
              <div className="action-row" key={q.public_id}>
                <span>{q.seq} · {q.name}</span>
                <Select size="small" value={p.action_map[q.public_id] ?? 'move_to_tail'}
                  style={{ width: 140 }}
                  onChange={(v: QueueAction) => patch(i, {
                    action_map: { ...p.action_map, [q.public_id]: v },
                  })}
                  options={Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label }))} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
