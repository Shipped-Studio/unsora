"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WarningCircle, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { MediaItem } from "@/lib/scheduler/composer-state";
import { cn } from "@/lib/utils";

function SortableTile({
  item,
  index,
  onRemove,
  warning,
  selected,
  onSelect,
  className,
}: {
  item: MediaItem;
  index: number;
  onRemove: () => void;
  warning?: string;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/tile relative overflow-hidden rounded-lg bg-card",
        isDragging && "z-10 opacity-80 shadow-md",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        aria-label={`Image ${index + 1}. Drag to reorder${onSelect ? ", click to use as cover" : ""}.`}
        className="block size-full cursor-grab touch-none outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:cursor-grabbing"
      >
        <img
          src={item.previewUrl}
          alt=""
          draggable={false}
          className="size-full object-cover"
        />
      </button>

      <span className="pointer-events-none absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-scrim/60 text-2xs font-medium text-media-foreground tabular-nums">
        {index + 1}
      </span>

      <Button
        type="button"
        size="icon-xs"
        variant="secondary"
        aria-label={`Remove image ${index + 1}`}
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 shadow-xs [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/tile:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
      >
        <X />
      </Button>

      {item.status === "uploading" ? (
        <div className="absolute inset-x-1.5 bottom-1.5">
          <Progress value={item.progress} className="h-1" />
        </div>
      ) : null}
      {item.status === "error" || warning ? (
        <span
          title={item.status === "error" ? item.error : warning}
          className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-scrim/70 px-1.5 py-0.5 text-2xs text-media-foreground"
        >
          <WarningCircle className="size-3 text-warning" />
          {item.status === "error" ? "Upload failed" : "Aspect ratio"}
        </span>
      ) : null}
    </div>
  );
}

/** Reorderable media tiles, as a grid or a single-row filmstrip. */
export function SortableMedia({
  items,
  layout,
  onReorder,
  onRemove,
  warnings,
  selectedIndex,
  onSelect,
  tileClassName,
  trailing,
}: {
  items: MediaItem[];
  layout: "grid" | "strip";
  onReorder: (from: number, to: number) => void;
  onRemove: (key: string) => void;
  warnings?: Record<string, string>;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  tileClassName?: string;
  trailing?: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.key === active.id);
    const to = items.findIndex((i) => i.key === over.id);
    if (from >= 0 && to >= 0) onReorder(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={items.map((i) => i.key)}
        strategy={layout === "grid" ? rectSortingStrategy : horizontalListSortingStrategy}
      >
        <div
          className={cn(
            layout === "grid"
              ? "grid grid-cols-3 gap-2 sm:grid-cols-4"
              : "flex gap-2 overflow-x-auto pb-1",
          )}
        >
          {items.map((item, index) => (
            <SortableTile
              key={item.key}
              item={item}
              index={index}
              warning={warnings?.[item.key]}
              onRemove={() => onRemove(item.key)}
              selected={selectedIndex === index}
              onSelect={onSelect ? () => onSelect(index) : undefined}
              className={tileClassName}
            />
          ))}
          {trailing}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export { arrayMove };
