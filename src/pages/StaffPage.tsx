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
  Avatar, Button, Col, Dropdown, Form, Input, Modal, Row, Select, Space, Tag, message,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { catalogApi } from '../api/catalog'
import { queryKeys } from '../api/keys'
import { staffApi } from '../api/queues'
import { staffCategoriesApi } from '../api/staffCategories'
import type { CreateStaffRequest, StaffSummary, UpdateStaffRequest } from '../api/types'
import PageHeader from '../components/PageHeader'
import StaffActionProvider from '../components/StaffActionProvider'
import { EmptyHint, ErrorState, PageLoading } from '../components/RequestState'
import { hasPermission, useAuthStore } from '../stores/authStore'
import { useShopStore } from '../stores/shopStore'
import { useStaffActionMenu, type StaffMenuBinding } from '../shop/staffActionContext'
import {
  STAFF_BUCKETS, bucketOf, stateLabel, type StaffBucket,
} from '../shop/staffStatus'

type StaffGender = 'unknown' | 'male' | 'female'

const GENDER_OPTIONS: { value: StaffGender; label: string }[] = [
  { value: 'unknown', label: '未填' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
]
const toStaffGender = (value?: string): StaffGender =>
  GENDER_OPTIONS.some((option) => option.value === value) ? value as StaffGender : 'unknown'
const genderLabel = (value?: string): string =>
  GENDER_OPTIONS.find((option) => option.value === value)?.label ?? '未填'

interface StaffForm {
  code: string
  alias?: string
  gender: StaffGender
  phone?: string
  display_name: string
}

interface StaffEditForm {
  code: string
  alias?: string
  gender: StaffGender
  phone?: string
  display_name: string
  status: 'active' | 'inactive'
  duty_status: 'on' | 'off'
  category_public_id?: string
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
  const [editForm] = Form.useForm<StaffEditForm>()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [bucket, setBucket] = useState<StaffBucket | 'all'>('all')
  const [detailTarget, setDetailTarget] = useState<StaffSummary | null>(null)
  const [editTarget, setEditTarget] = useState<StaffSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffSummary | null>(null)
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

  // "查" reads the server-side detail, not the card's cached summary.
  const detailQuery = useQuery({
    queryKey: queryKeys.staffDetail(shopId ?? '', detailTarget?.public_id ?? ''),
    queryFn: () => staffApi.get(shopId!, detailTarget!.public_id),
    enabled: Boolean(shopId && detailTarget),
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
    enabled: Boolean(qualTarget || detailTarget),
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
  const serviceNames = useMemo(
    () => new Map((catalogQ.data?.data ?? []).map((item) => [item.public_id, item.name] as const)),
    [catalogQ.data],
  )
  const editStatus = Form.useWatch('status', editForm)

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

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateStaffRequest }) =>
      staffApi.update(shopId!, id, body),
    onSuccess: () => {
      setEditTarget(null)
      message.success('服务人员资料已更新')
      refreshStaff()
    },
    onError: (error) => message.error((error as Error).message || '资料更新失败'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => staffApi.remove(shopId!, id),
    onSuccess: () => {
      setDeleteTarget(null)
      message.success('服务人员已删除')
      refreshStaff()
    },
    onError: (error) => message.error((error as Error).message || '删除失败'),
  })

  const openDetail = (item: StaffSummary) => setDetailTarget(item)

  const openEdit = (item: StaffSummary) => {
    editForm.setFieldsValue({
      code: item.code,
      alias: item.alias ?? '',
      gender: toStaffGender(item.gender),
      phone: item.phone ?? '',
      display_name: item.display_name,
      status: item.status === 'inactive' ? 'inactive' : 'active',
      duty_status: item.duty_status === 'on' ? 'on' : 'off',
      category_public_id: item.category?.public_id ?? '',
    })
    setEditTarget(item)
  }

  const submitEdit = (values: StaffEditForm) => {
    if (!editTarget) return
    const body: UpdateStaffRequest = {
      code: values.code.trim(),
      alias: (values.alias ?? '').trim(),
      gender: toStaffGender(values.gender),
      phone: (values.phone ?? '').trim(),
      display_name: values.display_name.trim(),
      status: values.status,
      // ADR-0015: an inactive operator cannot stay on duty.
      duty_status: values.status === 'inactive' ? 'off' : values.duty_status,
      category_public_id: values.category_public_id ?? '',
      version: editTarget.version,
    }
    update.mutate({ id: editTarget.public_id, body })
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
      return item.display_name.toLowerCase().includes(q)
        || item.code.toLowerCase().includes(q)
        || (item.alias ?? '').toLowerCase().includes(q)
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
                onDetail={() => openDetail(item)}
                onEdit={canWrite ? () => openEdit(item) : undefined}
                onDelete={canWrite ? () => setDeleteTarget(item) : undefined}
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
        title={`服务人员详情 · ${detailTarget?.display_name ?? ''}`}
        open={Boolean(detailTarget)}
        onCancel={() => setDetailTarget(null)}
        footer={<Button onClick={() => setDetailTarget(null)}>关闭</Button>}
        width={520}
        destroyOnHidden
      >
        {detailQuery.isPending ? <PageLoading /> : detailQuery.error ? (
          <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
        ) : detailQuery.data ? (
          <div className="staff-detail">
            <div className="staff-detail-grid">
              <div><span>工号</span><strong>{detailQuery.data.data.code}</strong></div>
              <div><span>姓名</span><strong>{detailQuery.data.data.display_name}</strong></div>
              <div><span>别名</span><strong>{detailQuery.data.data.alias || '—'}</strong></div>
              <div><span>性别</span><strong>{genderLabel(detailQuery.data.data.gender)}</strong></div>
              <div><span>手机号</span><strong>{detailQuery.data.data.phone || '—'}</strong></div>
              <div><span>状态</span><strong>{detailQuery.data.data.status === 'active' ? '启用' : '停用'}</strong></div>
              <div><span>在岗状态</span><strong>{detailQuery.data.data.duty_status === 'on' ? '在岗' : '离岗'}</strong></div>
              <div><span>分类</span><strong>{detailQuery.data.data.category?.name ?? '未分类'}</strong></div>
              <div>
                <span>所属班次</span>
                <strong>
                  {detailQuery.data.data.shift_template
                    ? `${detailQuery.data.data.shift_template.name} · ${detailQuery.data.data.shift_template.start_time}–${detailQuery.data.data.shift_template.end_time}`
                    : '未分配'}
                </strong>
              </div>
              <div><span>创建时间</span><strong>{detailQuery.data.data.created_at}</strong></div>
              <div><span>最后更新</span><strong>{detailQuery.data.data.updated_at}</strong></div>
            </div>
            <div className="staff-detail-section">
              <h4>所属队列</h4>
              {detailQuery.data.data.queues.length === 0 ? (
                <span className="staff-queue-empty">未分配队列</span>
              ) : detailQuery.data.data.queues.map((queue) => (
                <Tag key={queue.public_id}>{queue.seq} · {queue.name}</Tag>
              ))}
            </div>
            <div className="staff-detail-section">
              <h4>服务项资质</h4>
              {(detailQuery.data.data.service_item_ids ?? []).length === 0 ? (
                <span className="staff-queue-empty">暂无服务项资质</span>
              ) : (detailQuery.data.data.service_item_ids ?? []).map((id) => (
                <Tag key={id}>{serviceNames.get(id) ?? id}</Tag>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={`编辑服务人员 · ${editTarget?.display_name ?? ''}`}
        open={Boolean(editTarget)}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
        confirmLoading={update.isPending}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <p className="qual-hint">工号在本店必须唯一；停用后会自动置为离岗。</p>
        <Form form={editForm} layout="vertical" onFinish={submitEdit}>
          <div className="staff-form-section">基本信息</div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="工号"
                rules={[{ required: true, message: '请输入工号' }, { whitespace: true, message: '工号不能为空' }]}
              >
                <Input maxLength={40} placeholder="例如：S001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="display_name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }, { whitespace: true, message: '姓名不能为空' }]}
              >
                <Input maxLength={60} placeholder="例如：张三" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="alias" label="别名" extra="可选，留空清除；用于展示与搜索">
                <Input maxLength={60} placeholder="例如：小王" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="gender" label="性别">
                <Select options={GENDER_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <div className="staff-form-section">联系信息</div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phone" label="手机号" extra="可选；6–15 位数字，留空清除">
                <Input maxLength={32} placeholder="例如：13800138000" />
              </Form.Item>
            </Col>
          </Row>
          <div className="staff-form-section">任职设置</div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select
                  options={[
                    { value: 'active', label: '启用' },
                    { value: 'inactive', label: '停用' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="duty_status" label="在岗状态">
                <Select
                  disabled={editStatus === 'inactive'}
                  options={[
                    { value: 'on', label: '在岗' },
                    { value: 'off', label: '离岗' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category_public_id" label="分类" extra="留空表示取消分类">
                <Select
                  options={categoryOptions}
                  loading={categoryQ.isLoading}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择一个分类"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="删除服务人员"
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onOk={() => deleteTarget && remove.mutate(deleteTarget.public_id)}
        confirmLoading={remove.isPending}
        okText="确认删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <p>确定删除「{deleteTarget?.display_name}」（{deleteTarget?.code}）吗？此操作不可撤销。</p>
        <p className="qual-hint">已有关联记录（例如持卡历史、单据明细）的人员无法删除，请先停用并保留档案。</p>
      </Modal>

      <Modal
        title="新建服务人员"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="建档"
        cancelText="取消"
        width={560}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ gender: 'unknown' }}
          onFinish={(values) => create.mutate({
            ...values,
            code: values.code.trim(),
            alias: (values.alias ?? '').trim(),
            gender: toStaffGender(values.gender),
            phone: (values.phone ?? '').trim(),
          })}
        >
          <div className="staff-form-section">基本信息</div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="工号"
                rules={[{ required: true, message: '请输入工号' }, { whitespace: true, message: '工号不能为空' }]}
              >
                <Input maxLength={40} placeholder="例如：S001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="display_name"
                label="姓名"
                rules={[{ required: true, message: '请输入姓名' }, { whitespace: true, message: '姓名不能为空' }]}
              >
                <Input maxLength={60} placeholder="例如：张三" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="alias" label="别名" extra="可选，用于展示与搜索">
                <Input maxLength={60} placeholder="例如：小王" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="gender" label="性别">
                <Select options={GENDER_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <div className="staff-form-section">联系信息</div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phone" label="手机号" extra="可选；6–15 位数字">
                <Input maxLength={32} placeholder="例如：13800138000" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

function StaffWallCard({
  item, binding, onDetail, onEdit, onDelete, onQualification, onCategory,
}: {
  item: StaffSummary
  binding: StaffMenuBinding
  onDetail: () => void
  onEdit?: () => void
  onDelete?: () => void
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
            <strong>
              {item.display_name}
              {item.gender && item.gender !== 'unknown' ? (
                <em className="staff-gender-tag">{genderLabel(item.gender)}</em>
              ) : null}
            </strong>
            <span>
              {item.code}{item.alias ? ` · ${item.alias}` : ''}
              {item.phone ? ` · ${item.phone}` : ''} · {item.category?.name ?? '未分类'}
            </span>
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
          <span className="staff-open-hint">点击操作</span>
        </div>
        <div className="staff-wall-actions">
          <button
            type="button"
            className="staff-qual-btn"
            onClick={(event) => { event.stopPropagation(); onDetail() }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            详情
          </button>
          {onEdit ? (
            <button
              type="button"
              className="staff-qual-btn"
              onClick={(event) => { event.stopPropagation(); onEdit() }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              编辑
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="staff-qual-btn is-danger"
              onClick={(event) => { event.stopPropagation(); onDelete() }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              删除
            </button>
          ) : null}
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
        </div>
      </article>
    </Dropdown>
  )
}
