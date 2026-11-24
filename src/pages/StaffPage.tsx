/**
 * Staff wall (porch-os ADR-0015 / design/13). Cards are coloured by the
 * scheduling state bucket; clicking a card opens the operator menu (state,
 * position, hold, rotation). The menu itself lives in StaffActionProvider so the
 * queue board and the dispatch board offer exactly the same actions.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined, PlusOutlined,
  SearchOutlined, TeamOutlined,
} from '@ant-design/icons'
import {
  Avatar, Button, Dropdown, Form, Input, Modal, Select, Space, message,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { catalogApi } from '../api/catalog'
import { queryKeys } from '../api/keys'
import { staffApi } from '../api/queues'
import { staffCategoriesApi } from '../api/staffCategories'
import type { CreateStaffRequest, StaffSummary } from '../api/types'
import PageHeader from '../components/PageHeader'
import StaffActionProvider from '../components/StaffActionProvider'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'
import { useStaffActionMenu, type StaffMenuBinding } from '../shop/staffActionContext'
import {
  STAFF_BUCKETS, bucketOf, stateLabel, type StaffBucket,
} from '../shop/staffStatus'

interface StaffForm {
  code: string
  display_name: string
}

export default function StaffPage() {
  const shopId = useShopStore((state) => state.currentShopId)
  const permissions = useAuthStore((state) => state.permissions)
  const canWrite = hasPermission(permissions, 'queue.write')
  const canSchedule = hasPermission(permissions, 'scheduling.write')

  if (!shopId) return <EmptyHint>请先选择一个门店</EmptyHint>

  return (
    <StaffActionProvider shopId={shopId} canWrite={canWrite} canSchedule={canSchedule}>
      <StaffWall canWrite={canWrite} />
    </StaffActionProvider>
  )
}

function StaffWall({ canWrite }: { canWrite: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const shopId = useShopStore((state) => state.currentShopId)
  const { menuProps } = useStaffActionMenu()
  const [form] = Form.useForm<StaffForm>()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [bucket, setBucket] = useState<StaffBucket | 'all'>('all')
  const [qualTarget, setQualTarget] = useState<StaffSummary | null>(null)
  const [qualIds, setQualIds] = useState<string[]>([])
  const [categoryTarget, setCategoryTarget] = useState<StaffSummary | null>(null)
  const [categoryId, setCategoryId] = useState<string>('')
  const [newCategoryName, setNewCategoryName] = useState('')

  const staffQuery = useQuery({
    queryKey: queryKeys.staff(shopId ?? ''),
    queryFn: () => staffApi.list(shopId!),
    enabled: Boolean(shopId),
  })

  const create = useMutation({
    mutationFn: (body: CreateStaffRequest) => staffApi.create(shopId!, body),
    onSuccess: () => {
      setOpen(false)
      form.resetFields()
      message.success('服务人员已建档')
      void staffQuery.refetch()
    },
    onError: (error) => message.error((error as Error).message || '建档失败'),
  })

  // ADR-0023: qualification is a shop-scoped staff ↔ service-item relation.
  // The catalog is global, so one query serves every card in this shop.
  const catalogQ = useQuery({
    queryKey: queryKeys.catalog,
    queryFn: () => catalogApi.list(),
    enabled: Boolean(qualTarget),
  })
  // ADR-0024: one shop-scoped category per staff member, used by the order
  // entry picker to filter people. It is classification, not qualification.
  const categoryQ = useQuery({
    queryKey: queryKeys.staffCategories(shopId ?? ''),
    queryFn: () => staffCategoriesApi.list(shopId!),
    enabled: Boolean(shopId),
  })
  const categoryOptions = useMemo(
    () => (categoryQ.data?.data ?? [])
      .filter((category) => category.status === 'active')
      .map((category) => ({ value: category.public_id, label: category.name })),
    [categoryQ.data],
  )

  const serviceOptions = useMemo(
    () => (catalogQ.data?.data ?? [])
      .filter((item) => item.type === 'service' && item.active)
      .map((item) => ({ value: item.public_id, label: `${item.name} · ${item.sku}` })),
    [catalogQ.data],
  )

  const saveQualification = useMutation({
    mutationFn: () => staffApi.setServiceItems(shopId!, qualTarget!.public_id, {
      catalog_item_ids: qualIds,
      version: qualTarget!.version,
    }),
    onSuccess: () => {
      setQualTarget(null)
      message.success('服务项资质已更新')
      void staffQuery.refetch()
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.staff(shopId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.staffDetail(shopId!, qualTarget?.public_id ?? '') }),
      ])
    },
    onError: (error) => message.error((error as Error).message || '资质保存失败'),
  })

  const openQualification = (item: StaffSummary) => {
    setQualTarget(item)
    setQualIds([...(item.service_item_ids ?? [])])
  }

  const openCategory = (item: StaffSummary) => {
    setCategoryTarget(item)
    setCategoryId(item.category?.public_id ?? '')
    setNewCategoryName('')
  }

  const refreshStaff = () => {
    void staffQuery.refetch()
    void queryClient.invalidateQueries({ queryKey: queryKeys.staff(shopId!) })
  }

  const saveCategory = useMutation({
    mutationFn: () => staffApi.update(shopId!, categoryTarget!.public_id, {
      category_public_id: categoryId,
      version: categoryTarget!.version,
    }),
    onSuccess: () => {
      setCategoryTarget(null)
      message.success('服务人员分类已更新')
      refreshStaff()
    },
    onError: (error) => message.error((error as Error).message || '分类保存失败'),
  })

  const createCategory = useMutation({
    mutationFn: () => staffCategoriesApi.create(shopId!, {
      code: `CAT-${Date.now().toString(36).toUpperCase()}`,
      name: newCategoryName.trim(),
      sort_order: (categoryQ.data?.data?.length ?? 0) + 1,
    }),
    onSuccess: (response) => {
      setNewCategoryName('')
      setCategoryId(response.data.public_id)
      void queryClient.invalidateQueries({ queryKey: queryKeys.staffCategories(shopId!) })
      message.success('分类已创建')
    },
    onError: (error) => message.error((error as Error).message || '分类创建失败'),
  })

  const staff = useMemo(() => staffQuery.data?.data ?? [], [staffQuery.data])
  const counts = useMemo(() => {
    const map = new Map<StaffBucket, number>()
    for (const item of staff) {
      const key = bucketOf(item.state)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [staff])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return staff.filter((item) => {
      if (bucket !== 'all' && bucketOf(item.state) !== bucket) return false
      if (!q) return true
      return item.display_name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
    })
  }, [staff, search, bucket])

  if (staffQuery.isPending) return <PageLoading />
  if (staffQuery.error) {
    return <ErrorState error={staffQuery.error} onRetry={() => void staffQuery.refetch()} />
  }

  const onDuty = staff.filter((item) => item.duty_status === 'on').length
  const serving = staff.filter((item) => {
    const b = bucketOf(item.state)
    return b === 'serving' || b === 'designated'
  }).length
  const leave = counts.get('leave') ?? 0

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Workspace / Staff"
        title="服务人员"
        description="每张卡片按当前状态着色；点击卡片可直接改状态、调位次、留位与停止轮转。"
        actions={
          <Space>
            <Button icon={<ArrowRightOutlined />} onClick={() => navigate('/queues')}>
              返回队列
            </Button>
            {canWrite ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => { form.resetFields(); setOpen(true) }}
              >
                新建服务人员
              </Button>
            ) : null}
          </Space>
        }
      />

      <div className="stat-strip">
        <div className="stat-tile">
          <span className="stat-icon slate"><TeamOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">人员总数</div>
            <div className="stat-value">{staff.length}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><CheckCircleOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">在岗</div>
            <div className="stat-value">{onDuty}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><ArrowRightOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">服务中 / 指定</div>
            <div className="stat-value">{serving}</div>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon amber"><ClockCircleOutlined /></span>
          <div className="stat-text">
            <div className="stat-label">请假</div>
            <div className="stat-value">{leave}</div>
          </div>
        </div>
      </div>

      <section className="panel staff-wall">
        <div className="staff-toolbar">
          <Input
            className="staff-search"
            allowClear
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder="搜索姓名或工号"
          />
          <div className="staff-legend" role="group" aria-label="按状态筛选">
            <button
              type="button"
              className={`staff-legend-chip ${bucket === 'all' ? 'is-active' : ''}`}
              onClick={() => setBucket('all')}
            >
              全部<em>{staff.length}</em>
            </button>
            {STAFF_BUCKETS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                data-bucket={entry.key}
                className={`staff-legend-chip ${bucket === entry.key ? 'is-active' : ''}`}
                onClick={() => setBucket(bucket === entry.key ? 'all' : entry.key)}
              >
                <span className="staff-legend-dot" />
                {entry.label}
                <em>{counts.get(entry.key) ?? 0}</em>
              </button>
            ))}
          </div>
        </div>

        {staff.length === 0 ? (
          <EmptyHint>该门店暂无服务人员{canWrite ? '，点击右上角建档' : ''}</EmptyHint>
        ) : visible.length === 0 ? (
          <EmptyHint>没有符合筛选条件的服务人员</EmptyHint>
        ) : (
          <div className="staff-grid">
            {visible.map((item) => (
              <StaffWallCard
                key={item.public_id}
                item={item}
                binding={menuProps(item)}
                onQualification={canWrite ? () => openQualification(item) : undefined}
                onCategory={canWrite ? () => openCategory(item) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <Modal
        title={`维护服务项 · ${qualTarget?.display_name ?? ''}`}
        open={Boolean(qualTarget)}
        onCancel={() => setQualTarget(null)}
        onOk={() => saveQualification.mutate()}
        confirmLoading={saveQualification.isPending}
        okText="保存资质"
        cancelText="取消"
        destroyOnHidden
      >
        <p className="qual-hint">
          只列出启用中的服务项；全量替换该服务员可执行的范围，不影响已开单据。
        </p>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          value={qualIds}
          onChange={setQualIds}
          options={serviceOptions}
          loading={catalogQ.isLoading}
          placeholder="选择该服务员可做的服务项"
          optionFilterProp="label"
          showSearch
          notFoundContent="该门店目录暂无启用的服务项"
        />
      </Modal>

      <Modal
        title={`维护分类 · ${categoryTarget?.display_name ?? ''}`}
        open={Boolean(categoryTarget)}
        onCancel={() => setCategoryTarget(null)}
        onOk={() => saveCategory.mutate()}
        confirmLoading={saveCategory.isPending}
        okText="保存分类"
        cancelText="取消"
        destroyOnHidden
      >
        <p className="qual-hint">一位服务员最多绑定一个分类；留空表示取消分类。</p>
        <Select
          style={{ width: '100%' }}
          value={categoryId || undefined}
          onChange={(value) => setCategoryId(value ?? '')}
          options={categoryOptions}
          loading={categoryQ.isLoading}
          placeholder="选择一个分类"
          allowClear
          showSearch
          optionFilterProp="label"
          notFoundContent="该门店暂无分类"
        />
        <Space.Compact style={{ width: '100%', marginTop: 12 }}>
          <Input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="新分类名称"
            maxLength={40}
          />
          <Button
            disabled={!newCategoryName.trim()}
            loading={createCategory.isPending}
            onClick={() => createCategory.mutate()}
          >新建</Button>
        </Space.Compact>
      </Modal>

      <Modal
        title="新建服务人员"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="建档"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}>
          <Form.Item
            name="code"
            label="工号"
            rules={[{ required: true, message: '请输入工号' }, { whitespace: true, message: '工号不能为空' }]}
          >
            <Input maxLength={40} placeholder="例如：S001" />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }, { whitespace: true, message: '姓名不能为空' }]}
          >
            <Input maxLength={60} placeholder="例如：张三" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function StaffWallCard({
  item, binding, onQualification, onCategory,
}: {
  item: StaffSummary
  binding: StaffMenuBinding
  onQualification?: () => void
  onCategory?: () => void
}) {
  const key = bucketOf(item.state)
  return (
    <Dropdown {...binding}>
      <article
        className="staff-card"
        data-bucket={key}
        data-muted={item.status === 'active' ? undefined : 'true'}
        data-actionable="true"
        role="button"
        tabIndex={0}
        aria-label={`${item.display_name}，${stateLabel(item.state)}，点击打开操作菜单`}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            binding.onOpenChange(true)
          }
          if (event.key === 'Escape') binding.onOpenChange(false)
        }}
      >
        <div className="staff-card-top">
          <Avatar size={36} className="staff-avatar">{item.display_name.slice(0, 1)}</Avatar>
          <div className="staff-identity">
            <strong>{item.display_name}</strong>
            <span>{item.code} · {item.category?.name ?? '未分类'}</span>
          </div>
          <span className="staff-state-pill">{stateLabel(item.state)}</span>
        </div>

        <div className="staff-card-queues">
          {item.queues.length === 0 ? (
            <span className="staff-queue-empty">未分配队列</span>
          ) : item.queues.map((q) => (
            <span className="staff-queue-chip" key={q.public_id}>
              <b>{q.seq} · {q.name}</b>
              <em>第 {q.position} 位</em>
              {q.pin_type !== 'none' ? <i>留位</i> : null}
            </span>
          ))}
        </div>

        <div className="staff-card-foot">
          <span className={`pill ${item.duty_status === 'on' ? 'on' : 'off'}`}>
            {item.duty_status === 'on' ? '在岗' : '离岗'}
          </span>
          {item.status !== 'active' ? <span className="pill off">停用</span> : null}
          {item.stop_rotation ? <span className="staff-no-rotation">不轮转</span> : null}
          {onCategory ? (
            <button
              type="button"
              className="staff-qual-btn"
              onClick={(event) => { event.stopPropagation(); onCategory() }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              分类 · {item.category?.name ?? '未分类'}
            </button>
          ) : null}
          {onQualification ? (
            <button
              type="button"
              className="staff-qual-btn"
              onClick={(event) => { event.stopPropagation(); onQualification() }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              服务项 {item.service_item_ids?.length ?? 0}
            </button>
          ) : null}
          <span className="staff-open-hint">点击操作</span>
        </div>
      </article>
    </Dropdown>
  )
}
