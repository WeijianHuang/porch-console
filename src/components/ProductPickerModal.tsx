/**
 * Add-product picker: the third independent entry in order entry (third
 * reference image). Quantity and two display-only attribution selectors sit
 * above product category tabs and a read-only performance/price table.
 *
 * ADR-0023 says product lines never carry an executor, so the attribution
 * selectors are UI-only: they are never sent to the server and never stored
 * on the order line. Performance columns come from catalog item attributes
 * and are display-only as well.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, InputNumber, Modal, Select, Table, Tabs, Tooltip } from 'antd'
import { catalogApi } from '../api/catalog'
import { queryKeys } from '../api/keys'
import type { CatalogItem, StaffSummary } from '../api/types'
import { formatCNY } from '../utils/money'

interface ProductPickerModalProps {
  open: boolean
  staff: StaffSummary[]
  items: CatalogItem[]
  onClose: () => void
  onAdd: (item: CatalogItem, quantity: number) => void
}

const ALL = '__all__'

function displayAmount(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '—'
  const text = String(value)
  if (!text.trim()) return '—'
  try {
    return formatCNY(text)
  } catch {
    return '—'
  }
}

export default function ProductPickerModal({
  open, staff, items, onClose, onAdd,
}: ProductPickerModalProps) {
  const [quantity, setQuantity] = useState<number>(1)
  const [primaryId, setPrimaryId] = useState<string | null>(null)
  const [secondaryId, setSecondaryId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState(ALL)

  const catalogCategoryQ = useQuery({
    queryKey: queryKeys.catalogCategories,
    queryFn: () => catalogApi.categories(),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setQuantity(1)
    setPrimaryId(null)
    setSecondaryId(null)
    setCategoryId(ALL)
  }, [open])

  const staffOptions = useMemo(
    () => staff
      .filter((person) => person.status === 'active')
      .map((person) => ({
        value: person.public_id,
        label: `${person.display_name} · ${person.code}`,
      })),
    [staff],
  )

  const productItems = useMemo(
    () => items.filter((item) => item.type === 'product' && item.active),
    [items],
  )

  // Only categories that actually carry a product are shown, so the tab bar
  // never mixes service groupings into the product workflow.
  const productCategories = useMemo(() => {
    const used = new Set(
      productItems
        .map((item) => item.category_public_id)
        .filter((id): id is string => Boolean(id)),
    )
    return (catalogCategoryQ.data?.data ?? []).filter((category) => used.has(category.public_id))
  }, [catalogCategoryQ.data?.data, productItems])

  const visibleItems = useMemo(
    () => productItems.filter((item) =>
      categoryId === ALL || item.category_public_id === categoryId),
    [productItems, categoryId],
  )

  const itemTabs = useMemo(
    () => [
      { key: ALL, label: '全部商品' },
      ...productCategories.map((category) => ({
        key: category.public_id,
        label: category.name,
      })),
    ],
    [productCategories],
  )

  const addItem = (item: CatalogItem) => {
    const value = quantity ?? 1
    if (value <= 0) return
    onAdd(item, value)
  }

  return (
    <Modal
      title="添加产品"
      open={open}
      onCancel={onClose}
      width={1080}
      footer={<Button onClick={onClose}>取消</Button>}
      destroyOnHidden
      maskClosable={false}
    >
      <div className="picker-toolbar product-picker-toolbar">
        <label className="picker-toolbar-field">
          <span>产品数量</span>
          <InputNumber
            className="product-quantity-input"
            min={0.01}
            step={1}
            precision={2}
            value={quantity}
            onChange={(value) => setQuantity(value ?? 1)}
          />
        </label>
        <Tooltip title="仅用于界面参考；按 ADR-0023 商品明细不绑定人员，这里的选择不会写入订单">
          <label className="picker-toolbar-field">
            <span>关联人员 1（仅展示）</span>
            <Select
              className="picker-staff-select"
              showSearch
              allowClear
              placeholder="选择人员"
              optionFilterProp="label"
              value={primaryId}
              options={staffOptions}
              onChange={(value) => setPrimaryId(value ?? null)}
            />
          </label>
        </Tooltip>
        <Tooltip title="仅用于界面参考；按 ADR-0023 商品明细不绑定人员，这里的选择不会写入订单">
          <label className="picker-toolbar-field">
            <span>关联人员 2（仅展示）</span>
            <Select
              className="picker-staff-select"
              showSearch
              allowClear
              placeholder="选择人员"
              optionFilterProp="label"
              value={secondaryId}
              options={staffOptions}
              onChange={(value) => setSecondaryId(value ?? null)}
            />
          </label>
        </Tooltip>
      </div>

      <Tabs
        className="picker-item-tabs"
        activeKey={categoryId}
        onChange={setCategoryId}
        items={itemTabs}
      />

      <Table
        className="data-table picker-service-table"
        rowKey="public_id"
        size="small"
        pagination={false}
        dataSource={visibleItems}
        scroll={{ y: 420 }}
        locale={{ emptyText: '该分类下没有可用商品' }}
        columns={[
          { title: '编号', dataIndex: 'sku', width: 120 },
          { title: '产品名', dataIndex: 'name' },
          {
            title: '业绩一', key: 'performance_primary', width: 120, align: 'right',
            render: (_: unknown, item: CatalogItem) =>
              displayAmount(item.attributes?.performance_primary),
          },
          {
            title: '业绩二', key: 'performance_secondary', width: 120, align: 'right',
            render: (_: unknown, item: CatalogItem) =>
              displayAmount(item.attributes?.performance_secondary),
          },
          {
            title: '价格', dataIndex: 'base_price', width: 120, align: 'right',
            render: (value: string) => <span className="cell-money">{formatCNY(value)}</span>,
          },
          {
            title: '操作', key: 'action', width: 90, align: 'center',
            render: (_: unknown, item: CatalogItem) => (
              <Button
                type="link"
                size="small"
                className="picker-add-link"
                disabled={!quantity || quantity <= 0}
                onClick={() => addItem(item)}
              >添加</Button>
            ),
          },
        ]}
      />
    </Modal>
  )
}
