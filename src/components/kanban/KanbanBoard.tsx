import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, AlignLeft } from "lucide-react";
import { COLUMNS, positionAt, type Card, type Status } from "@/lib/board";
import { cn } from "@/lib/utils";

const tone: Record<Status, { dot: string; chip: string; label: string }> = {
  todo: { dot: "bg-col-todo", chip: "bg-col-todo-soft text-col-todo", label: "To do" },
  in_progress: { dot: "bg-col-progress", chip: "bg-col-progress-soft text-col-progress", label: "In progress" },
  done: { dot: "bg-col-done", chip: "bg-col-done-soft text-col-done", label: "Done" },
};

type Grouped = Record<Status, Card[]>;
const group = (cards: Card[]): Grouped => {
  const g: Grouped = { todo: [], in_progress: [], done: [] };
  [...cards].sort((a, b) => a.position - b.position).forEach((c) => g[c.status]?.push(c));
  return g;
};

export function KanbanBoard({
  cards,
  filter,
  onMove,
  onAdd,
  onOpen,
}: {
  cards: Card[];
  filter: string;
  onMove: (id: string, status: Status, position: number) => void;
  onAdd: (status: Status) => void;
  onOpen: (card: Card) => void;
}) {
  const [items, setItems] = useState<Grouped>(() => group(cards));
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeId) setItems(group(cards));
  }, [cards, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findCol = (id: string): Status | undefined => {
    if ((["todo", "in_progress", "done"] as string[]).includes(id)) return id as Status;
    return (Object.keys(items) as Status[]).find((s) => items[s].some((c) => c.id === id));
  };
  const active = useMemo(() => cards.find((c) => c.id === activeId) ?? null, [cards, activeId]);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragOver = (e: DragOverEvent) => {
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const from = findCol(String(e.active.id));
    const to = findCol(overId);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const moving = prev[from].find((c) => c.id === e.active.id);
      if (!moving) return prev;
      const target = prev[to];
      const idx = target.findIndex((c) => c.id === overId);
      const insertAt = idx < 0 ? target.length : idx;
      return {
        ...prev,
        [from]: prev[from].filter((c) => c.id !== moving.id),
        [to]: [...target.slice(0, insertAt), { ...moving, status: to }, ...target.slice(insertAt)],
      };
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    setActiveId(null);
    const col = findCol(id);
    if (!col || !overId) return;
    const list = items[col];
    const from = list.findIndex((c) => c.id === id);
    let to = list.findIndex((c) => c.id === overId);
    if (to < 0) to = list.length - 1;
    const reordered = [...list];
    const [m] = reordered.splice(from, 1);
    reordered.splice(to, 0, m);
    setItems((prev) => ({ ...prev, [col]: reordered }));
    const siblings = reordered.filter((c) => c.id !== id);
    const pos = positionAt(siblings, to);
    const orig = cards.find((c) => c.id === id);
    if (orig && (orig.status !== col || orig.position !== pos)) onMove(id, col, pos);
  };

  const q = filter.trim().toLowerCase();
  const visible = (c: Card) => !q || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto pb-6 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <Column key={col.id} status={col.id} label={col.label} cards={items[col.id].filter(visible)} onAdd={onAdd} onOpen={onOpen} dragging={!!activeId} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }}>
        {active ? <CardView card={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  label,
  cards,
  onAdd,
  onOpen,
  dragging,
}: {
  status: Status;
  label: string;
  cards: Card[];
  onAdd: (s: Status) => void;
  onOpen: (c: Card) => void;
  dragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section className="flex min-h-0 flex-col">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          {label} <span className="ml-1 font-normal text-muted-foreground">{cards.length}</span>
        </h2>
        <button
          onClick={() => onAdd(status)}
          aria-label={`Add card to ${label}`}
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-card hover:text-foreground hover:shadow-card"
        >
          <Plus className="size-4" />
        </button>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-40 flex-1 flex-col gap-3 rounded-2xl p-1 transition-colors",
          isOver && "bg-brand-soft/60",
        )}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} onOpen={onOpen} />
          ))}
        </SortableContext>
        {(cards.length === 0 || dragging) && (
          <div
            className={cn(
              "grid min-h-24 place-items-center rounded-2xl border-2 border-dashed border-border text-center text-xs text-muted-foreground transition",
              isOver && "border-brand text-brand",
            )}
          >
            {dragging ? "Drop the card here" : "No cards yet"}
          </div>
        )}
      </div>
    </section>
  );
}

function SortableCard({ card, onOpen }: { card: Card; onOpen: (c: Card) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card)}
    >
      <CardView card={card} />
    </div>
  );
}

function CardView({ card, overlay }: { card: Card; overlay?: boolean }) {
  const t = tone[card.status];
  return (
    <article
      className={cn(
        "group cursor-grab rounded-2xl bg-card p-4 shadow-card card-lift active:cursor-grabbing",
        overlay && "rotate-[-4deg] scale-105 shadow-lift",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", t.chip)}>{t.label}</span>
        <GripVertical className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </div>
      <h3 className="mt-3 font-display text-[15px] font-semibold leading-snug">{card.title}</h3>
      {card.description && (
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{card.description}</p>
      )}
      {card.description && (
        <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
          <AlignLeft className="size-3" /> Notes
        </div>
      )}
    </article>
  );
}
