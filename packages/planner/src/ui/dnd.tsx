import { closestCenter, DndContext, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, type SortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDragSensors } from 'linkshelf'
import type { CSSProperties, ReactNode } from 'react'

/**
 * ドラッグでの並べ替え。
 * - マウス: 5px 動かすとドラッグ（ただのクリックはそのまま押せる）
 * - スマホ: 長押し（0.25 秒）でドラッグ（ふつうに指を動かせばスクロール）
 * - キーボード: 行にフォーカスしてスペース → 矢印 → スペース
 */
export function SortableList({
  ids,
  strategy,
  onMove,
  onDragging,
  children,
}: {
  ids: string[]
  strategy: SortingStrategy
  /** overId は、落とした先の行（並べ替え）か、行のほかに置いた落とし先（useDroppable）の id */
  onMove: (activeId: string, overId: string) => void
  /** ドラッグを始めた・終えた（ドラッグの間だけ出す落とし先のため） */
  onDragging?: (dragging: boolean) => void
  children: ReactNode
}) {
  const sensors = useLampSensors()
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    onDragging?.(false)
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id))
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => onDragging?.(true)}
      onDragCancel={() => onDragging?.(false)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={strategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

/** 並べ替えられる行に付けるもの（ref・見た目の動き・ドラッグの合図） */
export function useSortableRow(id: string, disabled: boolean | { draggable: boolean; droppable: boolean } = false) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 5 } : {}),
  }
  return {
    ref: setNodeRef,
    activatorRef: setActivatorNodeRef,
    style,
    isDragging,
    // 行そのものをつかめるように（li の役割は list item のままにする）。
    // 並べ替えを止めているときも、行の中のチェックなどは押せるので aria-disabled は付けない
    handleProps: { ...attributes, ...listeners, role: undefined, 'aria-disabled': undefined },
  }
}

/**
 * まほうのランプのドラッグの合図。マウス 5px・長押し 0.25 秒は linkshelf の棚と同じ（useDragSensors）。
 * それに、キーボード（スペース → 矢印 → スペース）を足す
 */
export function useLampSensors() {
  return useSensors(...useDragSensors(), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
}
