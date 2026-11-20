/** 8-step decision chain configuration (ADR-0012 / design/12). */
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Input, InputNumber, Popconfirm, Select, Space, Switch, Table, Tag, TimePicker, message,
} from 'antd'
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
const METHOD_LABEL: Record<string, string> = { rotational: '轮转', designated: '指定' }

/** Server rows carry ids/version the publish payload does not accept. */
const toRuleInput = (r: SchedulingRule): RuleInput => ({
  type: r.type, order: r.order, enabled: r.enabled, scope: r.scope,
  scope_id: r.scope_id, on_hit: r.on_hit, time_window: r.time_window,
  assignment_methods: r.assignment_methods, from_group: r.from_group,
  to_group: r.to_group, no_rotation: r.no_rotation,
})

export default function RulesPage() {
  const shopId = useShopStore((s) => s.currentShopId)
  const qc = useQueryClient()
  const [draft, setDraft] = useState<RuleInput[]>([])
  const q = useQuery({
    queryKey: queryKeys.schedulingRules(shopId ?? ''),
    queryFn: () => schedulingApi.rules(shopId!),
    enabled: !!shopId,
  })
  // Scope candidates come from the same read-only endpoints the board uses;
  // no local id is invented (DA-01).
  const boardQ = useQuery({
    queryKey: queryKeys.schedulingBoard(shopId ?? ''),
    queryFn: () => schedulingApi.board(shopId!),
    enabled: !!shopId,
  })
  const tasksQ = useQuery({
    queryKey: queryKeys.schedulingTaskTypes(shopId ?? ''),
    queryFn: () => schedulingApi.taskTypes(shopId!),
    enabled: !!shopId,
  })
  useEffect(() => {
    if (q.data?.data) setDraft(q.data.data.map(toRuleInput))
  }, [q.data])

  const saved = useMemo(() => q.data?.data.map(toRuleInput) ?? [], [q.data])
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved],
  )
  const duplicateOrder = useMemo(
    () => new Set(draft.map((r) => r.order)).size !== draft.length, [draft],
  )

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

  const scopeOptions = (scope: ScopeLevel) => {
    if (scope === 'executor') {
      return (boardQ.data?.data.executors ?? []).map((e) => ({
        value: e.public_id, label: `${e.code} · ${e.display_name}`,
      }))
    }
    if (scope === 'queue') {
      return (boardQ.data?.data.queues ?? []).map((x) => ({
        value: x.public_id, label: `${x.seq} · ${x.name}`,
      }))
    }
    if (scope === 'task_type') {
      return (tasksQ.data?.data ?? []).map((t) => ({
        value: t.public_id, label: `${t.code} · ${t.name}`,
      }))
    }
    return []
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="调度引擎"
        title="判定链配置"
        description="8 步可配置，命中即停。作用域优先级：执行者 > 队列 > 任务类型 > 站点 > 全局。"
        actions={
          <Space>
            <Popconfirm
              title="载入默认 8 步判定链？"
              description="将覆盖当前草稿（未发布），确认后仍需点「发布新版本」才会写入站点。"
              okText="载入" cancelText="取消"
              onConfirm={() => setDraft(defaultRules())}
            >
              <Button disabled={mut.isPending}>载入默认规则</Button>
            </Popconfirm>
            <Popconfirm
              title="撤销未发布的修改？"
              description="草稿将恢复为最近一次已发布的判定链。"
              okText="撤销" cancelText="返回"
              disabled={!dirty}
              onConfirm={() => setDraft(saved)}
            >
              <Button disabled={!dirty || mut.isPending}>撤销</Button>
            </Popconfirm>
            <Popconfirm
              title="发布这版判定链？"
              description="发布后立即对本门店的派单生效，并写入审计流水。"
              okText="发布" cancelText="返回"
              disabled={!dirty || duplicateOrder}
              onConfirm={() => mut.mutate()}
            >
              <Button type="primary" loading={mut.isPending}
                disabled={!dirty || duplicateOrder || mut.isPending}>发布新版本</Button>
            </Popconfirm>
          </Space>
        }
      />
      {duplicateOrder ? (
        <Alert type="warning" showIcon className="rule-alert"
          title="顺序值重复，请先调整为 1–8 的唯一值再发布" />
      ) : null}
      {draft.length === 0 ? (
        <div className="panel rule-empty">
          <p className="muted">当前站点尚未初始化 8 步判定链规则。可载入推荐默认链，按需调整后发布即生效。</p>
          <Button type="primary" onClick={() => setDraft(defaultRules())}>载入默认规则</Button>
        </div>
      ) : (
        <Table<RuleInput>
          className="rule-table"
          rowKey={(r) => r.type}
          dataSource={[...draft].sort((a, b) => a.order - b.order)}
          pagination={false}
          size="small"
          scroll={{ x: 1480 }}
          columns={[
            { title: '顺序', dataIndex: 'order', width: 80, render: (v: number, r) =>
              <InputNumber min={1} max={99} value={v} size="small"
                onChange={(n) => patch(r.type, { order: n ?? 1 })} /> },
            { title: '判定步骤', dataIndex: 'type', width: 180,
              render: (v: RuleType) => TYPE_LABEL[v] ?? v },
            { title: '启用', dataIndex: 'enabled', width: 72, render: (v: boolean, r) =>
              <Switch size="small" checked={v} onChange={(on) => patch(r.type, { enabled: on })} /> },
            { title: '作用域', dataIndex: 'scope', width: 126, render: (v: ScopeLevel, r) =>
              <Select size="small" value={v} style={{ width: 114 }}
                onChange={(s: ScopeLevel) => patch(r.type, { scope: s, scope_id: '' })}
                options={Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label }))} /> },
            { title: '作用对象', dataIndex: 'scope_id', width: 184, render: (v: string, r) => {
              if (r.scope === 'site' || r.scope === 'global') {
                return <Tag>{r.scope === 'site' ? '当前站点' : '全部站点'}</Tag>
              }
              return (
                <Select size="small" allowClear value={v || undefined} style={{ width: 168 }}
                  placeholder="不限（全部）" options={scopeOptions(r.scope)}
                  onChange={(id) => patch(r.type, { scope_id: id ?? '' })} />
              )
            } },
            { title: '命中动作', dataIndex: 'on_hit', width: 110, render: (v: Decision, r) =>
              <Select size="small" value={v} style={{ width: 96 }}
                onChange={(d: Decision) => patch(r.type, { on_hit: d })}
                options={[{ value: 'hold', label: '保持' }, { value: 'rotate', label: '轮转' }]} /> },
            { title: '生效时段', dataIndex: 'time_window', width: 230,
              render: (v: SchedulingRule['time_window'], r) => (
                <TimePicker.RangePicker size="small" allowClear
                  placeholder={['开始', '结束']}
                  value={v ? [dayjs(`2000-01-01 ${v.start}`, 'YYYY-MM-DD HH:mm'),
                    dayjs(`2000-01-01 ${v.end}`, 'YYYY-MM-DD HH:mm')] : null}
                  format="HH:mm"
                  onChange={(vals) => patch(r.type, {
                    time_window: vals && vals[0] && vals[1]
                      ? {
                        start: vals[0].format('HH:mm'),
                        end: vals[1].format('HH:mm'),
                        ...(v?.days ? { days: v.days } : {}),
                      }
                      : null,
                  })} />
              ) },
            { title: '允许指派', dataIndex: 'assignment_methods', width: 160,
              render: (v: string[], r) => r.type === 'assignment_method_allows_rotation' ? (
                <Select size="small" mode="multiple" value={v ?? []} style={{ width: 144 }}
                  placeholder="请选择" options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
                  onChange={(methods: string[]) => patch(r.type, { assignment_methods: methods })} />
              ) : <span className="muted">—</span> },
            { title: '跨组', key: 'groups', width: 200, render: (_: unknown, r) =>
              r.type === 'group_a_to_b' || r.type === 'group_b_to_a' ? (
                <Space size={4}>
                  <Input size="small" style={{ width: 82 }} placeholder="来源组"
                    value={r.from_group}
                    onChange={(e) => patch(r.type, { from_group: e.target.value })} />
                  <Input size="small" style={{ width: 82 }} placeholder="目标组"
                    value={r.to_group}
                    onChange={(e) => patch(r.type, { to_group: e.target.value })} />
                </Space>
              ) : <span className="muted">—</span> },
            { title: '不轮转', dataIndex: 'no_rotation', width: 90, render: (v: boolean, r) =>
              <Switch size="small" checked={v} onChange={(on) => patch(r.type, { no_rotation: on })} /> },
          ]}
        />
      )}
    </div>
  )
}
