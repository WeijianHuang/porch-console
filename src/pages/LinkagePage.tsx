/** Linkage policy configuration (ADR-0012 / design/12). */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Input, InputNumber, Popconfirm, Select, Space, Tag, message } from 'antd'
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

/** localId is UI-only: it keeps edits aligned after a delete, and is never sent. */
type DraftPolicy = PolicyInput & { localId: string }

const toDraft = (p: PolicyInput): DraftPolicy => ({ ...p, localId: crypto.randomUUID() })

const toInput = (p: PolicyInput): PolicyInput => ({
  primary_queue_id: p.primary_queue_id, mode: p.mode, allowlist: p.allowlist,
  exclude: p.exclude, group: p.group, action_map: p.action_map, insert_at: p.insert_at,
})

export default function LinkagePage() {
  const shopId = useShopStore((s) => s.currentShopId)
  const qc = useQueryClient()
  const [draft, setDraft] = useState<DraftPolicy[]>([])
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
    if (q.data?.data) setDraft(q.data.data.map(toDraft))
  }, [q.data])

  const saved = useMemo(() => q.data?.data.map(toInput) ?? [], [q.data])
  const dirty = useMemo(() => JSON.stringify(draft.map(toInput)) !== JSON.stringify(saved), [draft, saved])
  const duplicatePrimary = useMemo(
    () => new Set(draft.map((p) => p.primary_queue_id)).size !== draft.length, [draft],
  )

  const mut = useMutation({
    mutationFn: () => schedulingApi.publishPolicies(shopId!, draft.map(toInput)),
    onSuccess: () => {
      message.success('联动策略已发布')
      if (shopId) void qc.invalidateQueries({ queryKey: queryKeys.schedulingPolicies(shopId) })
    },
    onError: (e) => message.error((e as Error).message ?? '发布失败'),
  })

  if (!shopId) return <PageLoading />
  if (q.isLoading) return <PageLoading />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />

  const queueOptions = (queuesQ.data?.data.queues ?? []).map((x) => ({
    value: x.public_id, label: `${x.seq} · ${x.name}`,
  }))
  const usedPrimaries = new Set(draft.map((p) => p.primary_queue_id))
  const hasFreeQueue = queueOptions.some((x) => !usedPrimaries.has(x.value))

  const patch = (localId: string, v: Partial<PolicyInput>) =>
    setDraft((prev) => prev.map((p) => (p.localId === localId ? { ...p, ...v } : p)))

  const addPolicy = () => {
    const next = queueOptions.find((x) => !usedPrimaries.has(x.value))
    if (!next) return
    setDraft((prev) => [...prev, toDraft({
      primary_queue_id: next.value, mode: 'independent',
      allowlist: [], exclude: [], group: '', action_map: {}, insert_at: {},
    })])
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="调度引擎"
        title="联动策略"
        description="一次派单按主队列传播到从队列；从队列按自身长度落位，绝不复制主队列位次。"
        actions={<Space>
          <TooltipButton title={hasFreeQueue ? '新增一条主队列策略' : '每个队列最多一条策略'}>
            <Button icon={<PlusOutlined />} disabled={!hasFreeQueue || mut.isPending}
              onClick={addPolicy}>新增策略</Button>
          </TooltipButton>
          <Popconfirm
            title="撤销未发布的修改？"
            description="草稿将恢复为最近一次已发布的联动策略。"
            okText="撤销" cancelText="返回" disabled={!dirty}
            onConfirm={() => setDraft(saved.map(toDraft))}
          >
            <Button disabled={!dirty || mut.isPending}>撤销</Button>
          </Popconfirm>
          <Popconfirm
            title="发布这版联动策略？"
            description="发布后立即对本门店的派单生效，并写入审计流水。"
            okText="发布" cancelText="返回"
            disabled={!dirty || duplicatePrimary}
            onConfirm={() => mut.mutate()}
          >
            <Button type="primary" loading={mut.isPending}
              disabled={!dirty || duplicatePrimary || mut.isPending}>发布</Button>
          </Popconfirm>
        </Space>}
      />
      <Alert type="info" showIcon
        title="联动为单向传播，从队列不会触发新一轮；置顶与冻结队列强制保持位次。" />
      {duplicatePrimary ? (
        <Alert type="warning" showIcon className="rule-alert"
          title="同一主队列只能有一条策略，请修改后再发布" />
      ) : null}
      {draft.length === 0 ? (
        <div className="panel rule-empty"><p className="muted">当前站点还没有联动策略，默认仅来源队列参与。</p></div>
      ) : draft.map((p) => {
        const primaryOptions = queueOptions.filter(
          (x) => x.value === p.primary_queue_id || !usedPrimaries.has(x.value),
        )
        return (
          <section className="panel linkage-panel" key={p.localId}>
            <div className="panel-head">
              <h2>{queueOptions.find((x) => x.value === p.primary_queue_id)?.label ?? '新策略'}</h2>
              <Popconfirm title="删除这条策略？" okText="删除" cancelText="返回"
                okButtonProps={{ danger: true }} disabled={mut.isPending}
                onConfirm={() => setDraft((prev) => prev.filter((x) => x.localId !== p.localId))}>
                <Button size="small" type="link" danger disabled={mut.isPending}>删除</Button>
              </Popconfirm>
            </div>
            <div className="form-grid">
              <label>
                <span>主队列</span>
                <Select value={p.primary_queue_id} style={{ width: '100%' }}
                  options={primaryOptions}
                  onChange={(v) => patch(p.localId, { primary_queue_id: v })} />
              </label>
              <label>
                <span>传播模式</span>
                <Select value={p.mode} style={{ width: '100%' }}
                  onChange={(v: PropagationMode) => patch(p.localId, { mode: v })}
                  options={Object.entries(MODE_LABEL).map(([value, label]) => ({ value, label }))} />
              </label>
              {p.mode === 'allowlist' ? (
                <label>
                  <span>参与队列（名单）</span>
                  <Select mode="multiple" value={p.allowlist} style={{ width: '100%' }} options={queueOptions}
                    onChange={(v) => patch(p.localId, { allowlist: v })} />
                </label>
              ) : null}
              {p.mode === 'exclude' ? (
                <label>
                  <span>排除队列</span>
                  <Select mode="multiple" value={p.exclude} style={{ width: '100%' }} options={queueOptions}
                    onChange={(v) => patch(p.localId, { exclude: v })} />
                </label>
              ) : null}
              {p.mode === 'same_group' ? (
                <label>
                  <span>分组标识</span>
                  <Input value={p.group}
                    onChange={(e) => patch(p.localId, { group: e.target.value })} placeholder="留空则用来源队列分组" />
                </label>
              ) : null}
            </div>
            <div className="panel-head"><h3>逐队列动作</h3><Tag>各自落位</Tag></div>
            <div className="action-map">
              {(queuesQ.data?.data.queues ?? []).map((qItem) => {
                const action = p.action_map[qItem.public_id] ?? 'move_to_tail'
                return (
                  <div className="action-row" key={qItem.public_id}>
                    <span>{qItem.seq} · {qItem.name}</span>
                    <Space size={8} wrap className="action-controls">
                      <Select size="small" value={action} style={{ width: 140 }}
                        onChange={(v: QueueAction) => patch(p.localId, {
                          action_map: { ...p.action_map, [qItem.public_id]: v },
                          insert_at: v === 'insert_at'
                            ? { ...p.insert_at, [qItem.public_id]: p.insert_at[qItem.public_id] ?? 1 }
                            : p.insert_at,
                        })}
                        options={Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label }))} />
                      {action === 'insert_at' ? (
                        <Space size={4} className="insert-position">
                          <span>第</span>
                          <InputNumber size="small" min={1} style={{ width: 72 }}
                            value={p.insert_at[qItem.public_id] ?? 1}
                            onChange={(n) => patch(p.localId, {
                              insert_at: { ...p.insert_at, [qItem.public_id]: n ?? 1 },
                            })} />
                          <span>位</span>
                        </Space>
                      ) : null}
                    </Space>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Thin wrapper so a disabled add button still explains the one-per-queue rule. */
function TooltipButton({ title, children }: { title: string; children: ReactNode }) {
  return <span title={title} className="tooltip-wrap">{children}</span>
}
