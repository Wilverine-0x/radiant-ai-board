export type Status = "todo" | "in_progress" | "done";

export const COLUMNS: { id: Status; label: string }[] = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

export type Card = {
  id: string;
  board_id: string;
  status: Status;
  title: string;
  description: string;
  position: number;
};

/** Position for an item dropped at `index` among `siblings` (already sorted, excluding the moved card). */
export function positionAt(siblings: { position: number }[], index: number): number {
  const before = siblings[index - 1]?.position;
  const after = siblings[index]?.position;
  if (before === undefined && after === undefined) return 1000;
  if (before === undefined) return after! - 1000;
  if (after === undefined) return before + 1000;
  return (before + after) / 2;
}
