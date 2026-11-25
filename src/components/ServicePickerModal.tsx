/**
 * Add-service picker (porch-console ADR-0008 / porch-os ADR-0024): reference
 * image 1. One toolbar row selects the executor and staff group, item-group
 * tabs filter the table, and each row adds a qualified service. Qualification
 * stays in ADR-0023 through qualifiedStaffForItem().
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Modal, Radio, Select, Table, Tabs, Tooltip, message } from 'antd'
import { catalogApi } from '../api/catalog'
import { queryKeys } from '../api/keys'
import { staffCategoriesApi } from '../api/staffCategories'
import type { CatalogItem, StaffSummary } from '../api/types'
import { isServiceItem, qualifiedStaffForItem } from '../shop/orderStaff'
import { formatCNY } from '../utils/money'

interface ServicePickerModalProps {
  open: boolean
  shopId: string
  staff: StaffSummary[]
  items: CatalogItem[]
  onClose: () => void
  onAdd: (item: CatalogItem, staffPublicID: string) => void
}

const ALL = '__all__'

export default function ServicePickerModal({
  open, shopId, staff, items, onClose, onAdd,
}: ServicePickerModalProps) {
  const [categoryId, setCategoryId] = useState(ALL)
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

  const selectableStaff = useMemo(
    () => staff.filter((s) =>
      s.status === 'active' &&
      (categoryId === ALL || s.category?.public_id === categoryId)),
    [staff, categoryId],
  )

  const staffOptions = useMemo(
    () => selectableStaff.map((person) => ({
      value: person.public_id,
      label: `${person.display_name} · ${person.code} · ${person.category?.name ?? '未分类'}`,
    })),
    [selectableStaff],
  )

  useEffect(() => {
    if (selectedId && !selectableStaff.some((person) => person.public_id === selectedId)) {
      setSelectedId(null)
    }
  }, [selectableStaff, selectedId])

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
      title="添加项目"
      open={open}
      onCancel={onClose}
      width={1120}
      footer={<Button onClick={onClose}>取消</Button>}
      destroyOnHidden
      maskClosable={false}
    >
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
        <div className="picker-toolbar-field">
          <span>服务分组</span>
          <Radio.Group
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <Radio value={ALL}>全部</Radio>
            {categories.map((category) => (
              <Radio key={category.public_id} value={category.public_id}>
                {category.name}
              </Radio>
            ))}
          </Radio.Group>
        </div>
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
        scroll={{ y: 360 }}
        locale={{ emptyText: '该分类下没有可用服务项' }}
        columns={[
          { title: '编号', dataIndex: 'sku', width: 90 },
          { title: '项目名', dataIndex: 'name' },
          {
            title: '服务类型', dataIndex: 'type', width: 110,
            render: (value: string) => value === 'service' ? '门店' : '商品',
          },
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
    </Modal>
  )
}
