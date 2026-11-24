/**
 * Assisted staff picker (porch-console ADR-0008 / porch-os ADR-0024).
 *
 * Layout follows the reference screen only in interaction order: filter
 * people by category and state, pick one person, then add qualified service
 * items to the order cart. The picker never grants capability by itself —
 * qualifications still come from ADR-0023 through qualifiedStaffForItem().
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Empty, Modal, Table, Tag, Tooltip, message } from 'antd'
import { catalogApi } from '../api/catalog'
import { queryKeys } from '../api/keys'
import { staffCategoriesApi } from '../api/staffCategories'
import type { CatalogItem, StaffSummary } from '../api/types'
import { isServiceItem, qualifiedStaffForItem } from '../shop/orderStaff'
import { STAFF_BUCKETS, bucketOf, stateLabel } from '../shop/staffStatus'
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
  const [categoryId, setCategoryId] = useState(ALL)
  const [bucket, setBucket] = useState(ALL)
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
    setCategoryId(ALL)
    setBucket(ALL)
    setItemCategoryId(ALL)
    setSelectedId(null)
  }, [open])

  const categories = (categoryQ.data?.data ?? []).filter((c) => c.status === 'active')
  const catalogCategories = catalogCategoryQ.data?.data ?? []
  const selectedStaff = staff.find((s) => s.public_id === selectedId) ?? null

  const visibleStaff = useMemo(
    () => staff.filter((s) => {
      if (s.status !== 'active') return false
      if (categoryId !== ALL && s.category?.public_id !== categoryId) return false
      if (bucket !== ALL && bucketOf(s.state) !== bucket) return false
      return true
    }),
    [staff, categoryId, bucket],
  )

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
      message.warning('请先选择一位服务员')
      return
    }
    if (!isQualified(item)) {
      message.warning('该服务员没有这项服务的资质')
      return
    }
    onAdd(item, selectedStaff.public_id)
  }

  return (
    <Modal
      title="选择服务员"
      open={open}
      onCancel={onClose}
      width={1120}
      footer={<Button onClick={onClose}>关闭</Button>}
      destroyOnHidden
      maskClosable={false}
    >
      <div className="picker-filter-block">
        <span className="picker-filter-label">分类</span>
        <div className="picker-chips">
          <button
            type="button"
            className={`picker-chip ${categoryId === ALL ? 'is-active' : ''}`}
            onClick={() => setCategoryId(ALL)}
          >全部</button>
          {categories.map((category) => (
            <button
              key={category.public_id}
              type="button"
              className={`picker-chip ${categoryId === category.public_id ? 'is-active' : ''}`}
              onClick={() => setCategoryId(category.public_id)}
            >{category.name}</button>
          ))}
        </div>
      </div>

      <div className="picker-filter-block">
        <span className="picker-filter-label">状态</span>
        <div className="picker-chips">
          <button
            type="button"
            className={`picker-chip ${bucket === ALL ? 'is-active' : ''}`}
            onClick={() => setBucket(ALL)}
          >全部</button>
          {STAFF_BUCKETS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`picker-chip ${bucket === item.key ? 'is-active' : ''}`}
              onClick={() => setBucket(item.key)}
            >{item.label}</button>
          ))}
        </div>
      </div>

      <div className="picker-staff-grid">
        {visibleStaff.length === 0 ? (
          <Empty description="该筛选条件下没有可用服务员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : visibleStaff.map((person) => (
          <button
            key={person.public_id}
            type="button"
            className={`picker-staff-card ${selectedId === person.public_id ? 'is-selected' : ''}`}
            onClick={() => setSelectedId(person.public_id)}
          >
            <strong>{person.display_name}</strong>
            <span>{person.code}</span>
            <span>{person.category?.name ?? '未分类'}</span>
            <span className="picker-staff-state">{stateLabel(person.state)}</span>
          </button>
        ))}
      </div>

      <div className="picker-selected-bar">
        {selectedStaff ? (
          <span>已选服务员：<Tag color="blue">{selectedStaff.display_name} · {selectedStaff.code}</Tag></span>
        ) : (
          <span className="muted">请先选择一位服务员，再添加下方服务项</span>
        )}
      </div>

      <div className="picker-filter-block">
        <span className="picker-filter-label">服务项分类</span>
        <div className="picker-chips">
          <button
            type="button"
            className={`picker-chip ${itemCategoryId === ALL ? 'is-active' : ''}`}
            onClick={() => setItemCategoryId(ALL)}
          >全部</button>
          {catalogCategories.map((category) => (
            <button
              key={category.public_id}
              type="button"
              className={`picker-chip ${itemCategoryId === category.public_id ? 'is-active' : ''}`}
              onClick={() => setItemCategoryId(category.public_id)}
            >{category.name}</button>
          ))}
        </div>
      </div>

      <Table
        className="data-table"
        rowKey="public_id"
        size="small"
        pagination={false}
        dataSource={serviceItems}
        locale={{ emptyText: '该分类下没有可用服务项' }}
        columns={[
          { title: '编号', dataIndex: 'sku', width: 120 },
          { title: '项目名', dataIndex: 'name' },
          {
            title: '持续时间', dataIndex: 'duration_minutes', width: 110,
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
                ? '请先选择一位服务员'
                : isQualified(item) ? '' : '该服务员没有这项服务的资质'
              return (
                <Tooltip title={reason || undefined}>
                  <Button
                    type="link"
                    size="small"
                    disabled={Boolean(reason)}
                    onClick={() => addItem(item)}
                  >添加</Button>
                </Tooltip>
              )
            },
          },
        ]}
      />
    </Modal>
  )
}
