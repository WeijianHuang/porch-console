/** 8-step decision chain configuration (ADR-0012 / design/12). */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, InputNumber, Popconfirm, Select, Space, Switch, Table, Tag, TimePicker, message } from 'antd'
import dayjs from 'dayjs'
import PageHeader from '../components/PageHeader'
import { ErrorState, PageLoading } from '../components/RequestState'
import { schedulingApi } from '../api/scheduling'
import { queryKeys } from '../api/keys'
import { useShopStore } from '../stores/shopStore'
import { defaultRules } from '../shop/defaultRules'
import type { Decision, RuleInput, RuleType, SchedulingRule, ScopeLevel } from '../api/types'

const TYPE_LABEL: Record<RuleType, string> = {
  executor_stopped_rotation: '执行者停止轮转',
  rotation_master_switch: '轮转总开关',
  assignment_method_allows_rotation: '指派方式允许轮转',
  task_type_no_rotation: '任务类型不轮转',
  overtime_no_rotation: '加班时段不轮转',
  time_reserved: '时段保留',
  group_a_to_b: 'A 组 → B 组任务',
  group_b_to_a: 'B 组 → A 组任务',
}
const SCOPE_LABEL: Record<ScopeLevel, string> = {
  executor: '执行者', queue: '队列', task_type: '任务类型', site: '站点', global: '全局',
}

export default function RulesPage() {
  const shopId = useShopStore((s) => s.currentShopId)
  const qc = useQueryClient()
  const [draft, setDraft] = useState<RuleInput[]>([])
  const q = useQuery({
    queryKey: queryKeys.schedulingRules(shopId ?? ''),
    queryFn: () => schedulingApi.rules(shopId!),
    enabled: !!shopId,
  })
  useEffect(() => {
    if (q.data?.data) {
      setDraft(q.data.data.map((r) => ({
        type: r.type, order: r.order, enabled: r.enabled, scope: r.scope,
        scope_id: r.scope_id, on_hit: r.on_hit, time_window: r.time_window,
        assignment_methods: r.assignment_methods, from_group: r.from_group,
        to_group: r.to_group, no_rotation: r.no_rotation,
      })))
    }
  }, [q.data])

  const mut = useMutation({
    mutationFn: () => schedulingApi.publishRules(shopId!, draft),
    onSuccess: () => {
      message.success('判定链已发布')
      if (shopId) void qc.invalidateQueries({ queryKey: queryKeys.schedulingRules(shopId) })
    },
    onError: (e) => message.error((e as Error).message ?? '发布失败'),
  })

  if (!shopId) return <PageLoading />
  if (q.isLoading) return <PageLoading />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />

  // Locate by the stable rule type, never by the sorted row index: the table
  // renders a sorted copy, so a positional index would edit the wrong rule
  // once the user changes an order value.
  const patch = (type: RuleType, v: Partial<RuleInput>) =>
    setDraft((prev) => prev.map((r) => (r.type === type ? { ...r, ...v } : r)))

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="调度引擎"
        title="判定链配置"
        description="8 步可配置，命中即停。作用域优先级：执行者 > 队列 > 任务类型 > 站点 > 全局。"
        actions={
          <Space>
            {draft.length > 0 && (
              <Popconfirm
                title="载入默认 8 步判定链？"
                description="将覆盖当前草稿（未发布），确认后仍需点「发布新版本」才会写入站点。"
                okText="载入" cancelText="取消"
                onConfirm={() => setDraft(defaultRules())}
              >
                <Button>载入默认规则</Button>
              </Popconfirm>
            )}
            <Button onClick={() => setDraft(q.data?.data.map((r) => ({
              type: r.type, order: r.order, enabled: r.enabled, scope: r.scope,
              scope_id: r.scope_id, on_hit: r.on_hit, time_window: r.time_window,
              assignment_methods: r.assignment_methods, from_group: r.from_group,
              to_group: r.to_group, no_rotation: r.no_rotation,
            })) ?? [])}>撤销</Button>
            <Button type="primary" loading={mut.isPending} onClick={() => mut.mutate()}>发布新版本</Button>
          </Space>
        }
      />
      {draft.length === 0 ? (
        <div className="panel rule-empty">
          <p className="muted">当前站点尚未初始化 8 步判定链规则。可载入推荐默认链，按需调整后发布即生效。</p>
          <Button type="primary" onClick={() => setDraft(defaultRules())}>载入默认规则</Button>
        </div>
      ) : (
        <Table<RuleInput>
          rowKey={(r) => r.type}
          dataSource={[...draft].sort((a, b) => a.order - b.order)}
          pagination={false}
          size="small"
          columns={[
            { title: '顺序', dataIndex: 'order', width: 80, render: (v: number, r) =>
              <InputNumber min={1} value={v} size="small"
                onChange={(n) => patch(r.type, { order: n ?? 1 })} /> },
            { title: '判定步骤', dataIndex: 'type', render: (v: RuleType) => TYPE_LABEL[v] ?? v },
            { title: '启用', dataIndex: 'enabled', width: 80, render: (v: boolean, r) =>
              <Switch size="small" checked={v} onChange={(on) => patch(r.type, { enabled: on })} /> },
            { title: '作用域', dataIndex: 'scope', width: 120, render: (v: ScopeLevel, r) =>
              <Select size="small" value={v} style={{ width: 108 }}
                onChange={(s) => patch(r.type, { scope: s })}
                options={Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label }))} /> },
            { title: '命中动作', dataIndex: 'on_hit', width: 110, render: (v: Decision, r) =>
              <Select size="small" value={v} style={{ width: 96 }}
                onChange={(d) => patch(r.type, { on_hit: d })}
                options={[{ value: 'hold', label: '保持' }, { value: 'rotate', label: '轮转' }]} /> },
            { title: '生效时段', dataIndex: 'time_window', width: 190, render: (v: SchedulingRule['time_window'], r) => {
              if (!v) return <Tag>全天</Tag>
              return (
                <Space size={2}>
                  <TimePicker.RangePicker size="small" allowClear
                    value={[dayjs(`2000-01-01 ${v.start}`, 'YYYY-MM-DD HH:mm'),
                      dayjs(`2000-01-01 ${v.end}`, 'YYYY-MM-DD HH:mm')]}
                    format="HH:mm"
                    onChange={(vals) => patch(r.type, {
                      time_window: vals && vals[0] && vals[1]
                        ? { start: vals[0].format('HH:mm'), end: vals[1].format('HH:mm') }
                        : null,
                    })} />
                </Space>
              )
            } },
            { title: '不轮转', dataIndex: 'no_rotation', width: 90, render: (v: boolean, r) =>
              <Switch size="small" checked={v} onChange={(on) => patch(r.type, { no_rotation: on })} /> },
          ]}
        />
      )}
    </div>
  )
}
