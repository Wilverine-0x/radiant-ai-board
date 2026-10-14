import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COLUMNS, type Status } from "@/lib/board";
import { cn } from "@/lib/utils";

export type CardDraft = { id?: string; title: string; description: string; status: Status };

export function CardDialog({
  draft,
  onClose,
  onSave,
  onDelete,
}: {
  draft: CardDraft | null;
  onClose: () => void;
  onSave: (d: CardDraft) => void;
  onDelete: (id: string) => void;
}) {
  const [d, setD] = useState<CardDraft | null>(draft);
  useEffect(() => setD(draft), [draft]);
  if (!d) return null;
  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{d.id ? "Edit card" : "New card"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (d.title.trim()) onSave({ ...d, title: d.title.trim() });
          }}
        >
          <Input autoFocus placeholder="Card title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} className="h-11 rounded-xl text-base" />
          <Textarea placeholder="Add a description…" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} className="min-h-32 rounded-xl" />
          <div className="flex gap-2">
            {COLUMNS.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => setD({ ...d, status: c.id })}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  d.status === c.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2">
            {d.id ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(d.id!)}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="rounded-full">Save card</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
