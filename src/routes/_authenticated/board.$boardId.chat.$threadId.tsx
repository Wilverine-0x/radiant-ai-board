import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { createThread } from "@/components/chat/threads";
import logo from "@/assets/pip-logo.png";

export const Route = createFileRoute("/_authenticated/board/$boardId/chat/$threadId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { boardId, threadId } = Route.useParams();
  const navigate = useNavigate();
  const thread = useQuery({
    queryKey: ["thread", threadId],
    queryFn: async () => {
      const [{ data: t, error: e1 }, { data: msgs, error: e2 }] = await Promise.all([
        supabase.from("chat_threads").select("id,title").eq("id", threadId).maybeSingle(),
        supabase.from("chat_messages").select("message").eq("thread_id", threadId).order("created_at"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { title: t?.title ?? "Chat", messages: (msgs ?? []).map((m) => m.message as unknown as UIMessage) };
    },
    staleTime: Infinity,
  });

  const newChat = async () => {
    try {
      const id = await createThread(boardId);
      navigate({ to: "/board/$boardId/chat/$threadId", params: { boardId, threadId: id } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-4">
        <Link to="/board/$boardId" params={{ boardId }} aria-label="All chats" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-4" />
        </Link>
        <img src={logo} alt="" width={28} height={28} className="size-7" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Pip</div>
          <div className="truncate text-xs text-muted-foreground">{thread.data?.title ?? "…"}</div>
        </div>
        <button onClick={newChat} aria-label="New chat" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Plus className="size-4" />
        </button>
      </header>
      {thread.data ? (
        <ChatWindow key={threadId} threadId={threadId} boardId={boardId} initialMessages={thread.data.messages} />
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
