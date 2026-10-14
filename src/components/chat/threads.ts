import { supabase } from "@/integrations/supabase/client";

export async function createThread(boardId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Please sign in");
  const { data, error } = await supabase
    .from("chat_threads")
    .insert({ board_id: boardId, user_id: u.user.id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
