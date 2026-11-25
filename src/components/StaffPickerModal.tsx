/**
 * Add-staff picker (porch-console ADR-0008 / porch-os ADR-0024): reference
 * image 2. State chips and staff-category tabs select one executor from the
 * people grid; the lower toolbar and service table add qualified services for
 * that executor. Qualification stays in ADR-0023.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Empty, Modal, Select, Table, Tabs, Tooltip, message } from 'antd'
import { catalogApi } from '../api/catalog'
import { queryKeys } from '../api/keys'
import { staffCategoriesApi } from '../api/staffCategories'
import type { CatalogItem, StaffSummary } from '../api/types'
import { isServiceItem, qualifiedStaffForItem } from '../shop/orderStaff'
import { MANUAL_STATES, STAFF_BUCKETS, bucketOf, stateLabel } from '../shop/staffStatus'
import { formatCNY } from '../utils/money'

interface StaffPickerModalProps {
  open: boolean
  shopId: string
  staff: StaffSummary[]
  items: CatalogItem[]
  onClose: () => void
  onAdd: (item: CatalogItem, staffPublicID: string) => void
}

const ALL = '__all__'

export default function StaffPickerModal({
  open, shopId, staff, items, onClose, onAdd,
}: StaffPickerModalProps) {
  const [stateFilter, setStateFilter] = useState(ALL)
  const [categoryId, setCategoryId] = useState(ALL)
  const [actionFilter, setActionFilter] = useState(ALL)
  const [itemCategoryId, setItemCategoryId] = useState(ALL)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const categoryQ = useQuery({
    queryKey: queryKeys.staffCategories(shopId),
    queryFn: () => staffCategoriesApi.list(shopId),
    enabled: open,
  })
  const catalogCategoryQ = useQuery({
    queryKey: queryKeys.catalogCategories,
    queryFn: () => catalogApi.categories(),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setStateFilter(ALL)
    setCategoryId(ALL)
    setActionFilter(ALL)
    setItemCategoryId(ALL)
    setSelectedId(null)
  }, [open])

  const categories = useMemo(
    () => (categoryQ.data?.data ?? []).filter((c) => c.status === 'active'),
    [categoryQ.data?.data],
  )
  const catalogCategories = useMemo(
    () => catalogCategoryQ.data?.data ?? [],
    [catalogCategoryQ.data?.data],
  )

  const visibleStaff = useMemo(
    () => staff.filter((person) => {
      if (person.status !== 'active') return false
      if (categoryId !== ALL && person.category?.public_id !== categoryId) return false
      if (stateFilter !== ALL && bucketOf(person.state) !== stateFilter) return false
      if (actionFilter !== ALL && person.state !== actionFilter) return false
      return true
    }),
    [staff, categoryId, stateFilter, actionFilter],
  )

  const staffOptions = useMemo(
    () => visibleStaff.map((person) => ({
      value: person.public_id,
      label: `${person.display_name} · ${person.code} · ${person.category?.name ?? '未分类'}`,
    })),
    [visibleStaff],
  )

  useEffect(() => {
    if (selectedId && !visibleStaff.some((person) => person.public_id === selectedId)) {
      setSelectedId(null)
    }
  }, [visibleStaff, selectedId])

  const selectedStaff = staff.find((s) => s.public_id === selectedId) ?? null

  const serviceItems = useMemo(
    () => items.filter((item) => {
      if (!isServiceItem(item) || !item.active) return false
      return itemCategoryId === ALL || item.category_public_id === itemCategoryId
    }),
    [items, itemCategoryId],
  )

  const isQualified = (item: CatalogItem) =>
    selectedStaff !== null && qualifiedStaffForItem([selectedStaff], item.public_id).length > 0

  const addItem = (item: CatalogItem) => {
    if (!selectedStaff) {
      message.warning('请先选择执行服务员')
      return
    }
    if (!isQualified(item)) {
      message.warning('该服务员没有这项服务的资质')
      return
    }
    onAdd(item, selectedStaff.public_id)
  }

  const staffCategoryTabs = useMemo(
    () => [
      { key: ALL, label: '全部分组' },
      ...categories.map((category) => ({
        key: category.public_id,
        label: category.name,
      })),
    ],
    [categories],
  )

  const itemTabs = useMemo(
    () => [
      { key: ALL, label: '全部项目' },
      ...catalogCategories.map((category) => ({
        key: category.public_id,
        label: category.name,
      })),
    ],
    [catalogCategories],
  )

  return (
    <Modal
      title="选择服务员"
      open={open}
      onCancel={onClose}
      width={1180}
      footer={<Button onClick={onClose}>取消</Button>}
      destroyOnHidden
      maskClosable={false}
    >
      <div className="staff-picker-state-row">
        <button
          type="button"
          className={`staff-state-chip ${stateFilter === ALL ? 'is-active' : ''}`}
          onClick={() => setStateFilter(ALL)}
        >全部</button>
        {STAFF_BUCKETS.map((bucket) => (
          <button
            key={bucket.key}
            type="button"
            className={`staff-state-chip is-${bucket.key} ${stateFilter === bucket.key ? 'is-active' : ''}`}
            onClick={() => setStateFilter(bucket.key)}
          >{bucket.label}</button>
        ))}
      </div>

      <Tabs
        className="staff-picker-group-tabs"
        activeKey={categoryId}
        onChange={setCategoryId}
        items={staffCategoryTabs}
      />

      {visibleStaff.length === 0 ? (
        <Empty description="该筛选条件下没有可用服务员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="staff-picker-grid">
          {visibleStaff.map((person) => (
            <button
              key={person.public_id}
              type="button"
              className={`staff-picker-person is-${bucketOf(person.state)} ${selectedId === person.public_id ? 'is-selected' : ''}`}
              onClick={() => setSelectedId(person.public_id)}
            >
              <strong>{person.display_name}</strong>
              <span>{person.code}</span>
              <span>{person.category?.name ?? '未分类'}</span>
              <span>{stateLabel(person.state)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="staff-picker-lower">
        <div className="staff-picker-action-tabs">
          <button
            type="button"
            className={actionFilter === ALL ? 'is-active' : ''}
            onClick={() => setActionFilter(ALL)}
          >全部</button>
          {MANUAL_STATES.map((item) => (
            <button
              key={item.state}
              type="button"
              className={actionFilter === item.state ? 'is-active' : ''}
              onClick={() => setActionFilter(item.state)}
            >{item.label}</button>
          ))}
        </div>

        <div className="picker-toolbar">
          <label className="picker-toolbar-field">
            <span>执行服务员</span>
            <Select
              className="picker-staff-select"
              showSearch
              allowClear
              placeholder="选择服务员"
              optionFilterProp="label"
              value={selectedId}
              options={staffOptions}
              onChange={(value) => setSelectedId(value ?? null)}
            />
          </label>
        </div>

        <Tabs
          className="picker-item-tabs"
          activeKey={itemCategoryId}
          onChange={setItemCategoryId}
          items={itemTabs}
        />

        <Table
          className="data-table picker-service-table"
          rowKey="public_id"
          size="small"
          pagination={false}
          dataSource={serviceItems}
          scroll={{ y: 260 }}
          locale={{ emptyText: '该分类下没有可用服务项' }}
          columns={[
            { title: '编号', dataIndex: 'sku', width: 90 },
            { title: '项目名', dataIndex: 'name' },
            {
              title: '持续时间', dataIndex: 'duration_minutes', width: 120,
              render: (value: number | null) => value ? `${value} 分钟` : '—',
            },
            {
              title: '价格', dataIndex: 'base_price', width: 110, align: 'right',
              render: (value: string) => <span className="cell-money">{formatCNY(value)}</span>,
            },
            {
              title: '操作', key: 'action', width: 90, align: 'center',
              render: (_: unknown, item: CatalogItem) => {
                const reason = !selectedStaff
                  ? '请先选择执行服务员'
                  : isQualified(item) ? '' : '该服务员没有这项服务的资质'
                return (
                  <Tooltip title={reason || undefined}>
                    <Button
                      type="link"
                      size="small"
                      className="picker-add-link"
                      disabled={Boolean(reason)}
                      onClick={() => addItem(item)}
                    >添加</Button>
                  </Tooltip>
                )
              },
            },
          ]}
        />
      </div>
    </Modal>
  )
}
