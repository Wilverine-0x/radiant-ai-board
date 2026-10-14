import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { createThread } from "@/components/chat/threads";
import logo from "@/assets/pip-logo.png";

export const Route = createFileRoute("/_authenticated/board/$boardId/")({
  component: ThreadList,
});

function ThreadList() {
  const { boardId } = Route.useParams();
  const navigate = useNavigate();
  const threads = useQuery({
    queryKey: ["threads", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id,title,updated_at")
        .eq("board_id", boardId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const start = async () => {
    try {
      const id = await createThread(boardId);
      navigate({ to: "/board/$boardId/chat/$threadId", params: { boardId, threadId: id } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-col items-center rounded-3xl bg-brand-soft px-6 py-8 text-center">
        <img src={logo} alt="Pip" width={64} height={64} className="size-16" />
        <h2 className="mt-4 text-xl font-semibold">Hi, I'm Pip</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ask about this board, or tell me to add, move or update cards.</p>
        <Button className="mt-5 rounded-full" onClick={start}>
          <Plus className="size-4" /> New chat
        </Button>
      </div>
      <div className="mt-8 text-xs font-medium uppercase tracking-wider text-muted-foreground">Recent chats</div>
      <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
        {threads.data?.length === 0 && <p className="text-sm text-muted-foreground">No chats yet.</p>}
        {threads.data?.map((t) => (
          <Link
            key={t.id}
            to="/board/$boardId/chat/$threadId"
            params={{ boardId, threadId: t.id }}
            className="flex items-center gap-3 rounded-2xl border bg-card p-3 transition hover:shadow-card"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-col-todo-soft text-col-todo">
              <MessageSquare className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{t.title}</div>
              <div className="text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
