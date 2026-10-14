import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LayoutGrid, Plus, Search, LogOut, Pencil, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { CardDialog, type CardDraft } from "@/components/kanban/CardDialog";
import { Button } from "@/components/ui/button";
import type { Card, Status } from "@/lib/board";
import { cn } from "@/lib/utils";
import logo from "@/assets/pip-logo.png";

export const Route = createFileRoute("/_authenticated/board/$boardId")({
  head: () => ({
    meta: [
      { title: "Board — Flowboard" },
      { name: "description", content: "Plan, drag and track your team's work on a shared kanban board." },
      { property: "og:title", content: "Board — Flowboard" },
      { property: "og:description", content: "Plan, drag and track your team's work on a shared kanban board." },
    ],
  }),
  component: BoardLayout,
});

function BoardLayout() {
  const { boardId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);

  const boards = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const { data, error } = await supabase.from("boards").select("id,name").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const board = boards.data?.find((b) => b.id === boardId);

  const cards = useQuery({
    queryKey: ["cards", boardId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cards").select("*").eq("board_id", boardId).order("position");
      if (error) throw error;
      return data as Card[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`cards-${boardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `board_id=eq.${boardId}` }, () =>
        qc.invalidateQueries({ queryKey: ["cards", boardId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [boardId, qc]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["cards", boardId] });
  const onErr = (e: Error) => toast.error(e.message);

  const move = useMutation({
    mutationFn: async (v: { id: string; status: Status; position: number }) => {
      const { error } = await supabase.from("cards").update({ status: v.status, position: v.position }).eq("id", v.id);
      if (error) throw error;
    },
    onMutate: (v) => {
      qc.setQueryData<Card[]>(["cards", boardId], (old) => old?.map((c) => (c.id === v.id ? { ...c, ...v } : c)));
    },
    onError: (e: Error) => {
      onErr(e);
      refresh();
    },
  });

  const save = useMutation({
    mutationFn: async (d: CardDraft) => {
      if (d.id) {
        const { error } = await supabase.from("cards").update({ title: d.title, description: d.description, status: d.status }).eq("id", d.id);
        if (error) throw error;
      } else {
        const last = (cards.data ?? []).filter((c) => c.status === d.status).reduce((m, c) => Math.max(m, c.position), 0);
        const { error } = await supabase.from("cards").insert({
          board_id: boardId, title: d.title, description: d.description, status: d.status, position: last + 1000, created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setDraft(null);
      refresh();
    },
    onError: onErr,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft(null);
      refresh();
    },
    onError: onErr,
  });

  const newBoard = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("boards").insert({ name: "Untitled board", created_by: user.id }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["boards"] });
      navigate({ to: "/board/$boardId", params: { boardId: id } });
    },
    onError: onErr,
  });

  const rename = async (name: string) => {
    setEditingName(null);
    if (!name.trim() || name === board?.name) return;
    const { error } = await supabase.from("boards").update({ name: name.trim() }).eq("id", boardId);
    if (error) return onErr(error);
    qc.invalidateQueries({ queryKey: ["boards"] });
  };

  const displayName = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "You";

  return (
    <div className="h-screen p-3 md:p-6">
      <div className="flex h-full overflow-hidden rounded-[2rem] bg-background shadow-shell">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r px-5 py-7 lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            <img src={logo} alt="" width={32} height={32} className="size-8" />
            <span className="font-display text-lg font-semibold">Flowboard</span>
          </div>
          <div className="mt-10 flex items-center justify-between px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Boards
            <button onClick={() => newBoard.mutate()} aria-label="New board" className="rounded-md p-1 hover:bg-muted hover:text-foreground">
              <Plus className="size-3.5" />
            </button>
          </div>
          <nav className="mt-3 flex-1 space-y-1 overflow-y-auto">
            {boards.data?.map((b) => (
              <Link
                key={b.id}
                to="/board/$boardId"
                params={{ boardId: b.id }}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  b.id === boardId && "bg-muted font-semibold text-foreground",
                )}
              >
                <LayoutGrid className="size-4" />
                <span className="truncate">{b.name}</span>
                {b.id === boardId && <span className="absolute -right-5 h-6 w-1 rounded-l bg-foreground" />}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex items-center gap-3 rounded-2xl p-2">
            <div className="grid size-10 place-items-center rounded-full bg-brand-soft font-display font-semibold text-brand">
              {displayName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{displayName}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
            <button aria-label="Sign out" onClick={() => supabase.auth.signOut()} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col bg-canvas/40 px-5 pt-6 md:px-8">
          <div className="flex items-center gap-3">
            <label className="flex h-11 max-w-sm flex-1 items-center gap-2 rounded-full bg-card px-4 shadow-card">
              <Search className="size-4 text-muted-foreground" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search cards" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </label>
            <div className="flex-1" />
            <Button className="h-11 rounded-full px-5" onClick={() => setDraft({ title: "", description: "", status: "todo" })}>
              <Plus className="size-4" /> New card
            </Button>
          </div>

          <div className="mt-8 flex items-center gap-3">
            {editingName !== null ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => rename(editingName)}
                onKeyDown={(e) => e.key === "Enter" && rename(editingName)}
                className="font-display w-full max-w-xl bg-transparent text-4xl font-bold tracking-tight outline-none"
              />
            ) : (
              <>
                <h1 className="truncate text-3xl font-bold tracking-tight md:text-4xl">{board?.name ?? " "}</h1>
                <button aria-label="Rename board" onClick={() => setEditingName(board?.name ?? "")} className="rounded-full p-2 text-muted-foreground hover:bg-card hover:text-foreground">
                  <Pencil className="size-4" />
                </button>
              </>
            )}
          </div>
          <div className="mt-3 flex items-center gap-5 border-b text-sm">
            <span className="-mb-px border-b-2 border-brand pb-2.5 font-semibold text-brand">Board</span>
            <span className="pb-2.5 text-muted-foreground">{cards.data?.length ?? 0} cards</span>
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            {cards.isLoading ? (
              <div className="grid flex-1 grid-cols-3 gap-5">
                {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-card" />)}
              </div>
            ) : (
              <KanbanBoard
                cards={cards.data ?? []}
                filter={filter}
                onMove={(id, status, position) => move.mutate({ id, status, position })}
                onAdd={(status) => setDraft({ title: "", description: "", status })}
                onOpen={(c) => setDraft({ id: c.id, title: c.title, description: c.description, status: c.status })}
              />
            )}
          </div>
        </main>

        {/* Assistant */}
        <aside className="hidden w-[380px] shrink-0 flex-col border-l bg-background xl:flex">
          <Outlet />
        </aside>
      </div>

      <Link
        to="/board/$boardId"
        params={{ boardId }}
        className="fixed bottom-6 right-6 grid size-14 place-items-center rounded-full bg-brand text-brand-foreground shadow-lift xl:hidden"
        aria-label="Assistant (open on a wider screen)"
        onClick={() => toast("Widen your window to chat with Pip side-by-side.")}
      >
        <MessageCircle className="size-6" />
      </Link>

      <CardDialog draft={draft} onClose={() => setDraft(null)} onSave={(d) => save.mutate(d)} onDelete={(id) => remove.mutate(id)} />
    </div>
  );
}
