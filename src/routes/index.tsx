import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Flowboard — Your team boards" },
      { name: "description", content: "Open your team's kanban boards and plan work with Pip, the AI assistant." },
      { property: "og:title", content: "Flowboard — Your team boards" },
      { property: "og:description", content: "Open your team's kanban boards and plan work with Pip, the AI assistant." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: undefined } });
    let { data: board } = await supabase
      .from("boards")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!board) {
      const { data: created, error } = await supabase
        .from("boards")
        .insert({ name: "My first board", created_by: data.user.id })
        .select("id")
        .single();
      if (error) throw error;
      board = created;
    }
    throw redirect({ to: "/board/$boardId", params: { boardId: board.id } });
  },
  component: () => null,
});
