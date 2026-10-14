import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai/run-id";

const statusEnum = z.enum(["todo", "in_progress", "done"]);
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return json({ error: "Please sign in." }, 401);

        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) return json({ error: "Please sign in." }, 401);
        const userId = userData.user.id;

        const body = (await request.json()) as { messages: UIMessage[]; threadId: string; boardId: string };
        const { messages, threadId, boardId } = body;
        if (!Array.isArray(messages) || !threadId || !boardId) return json({ error: "Bad request" }, 400);

        const { data: thread } = await supabase.from("chat_threads").select("id,title").eq("id", threadId).maybeSingle();
        if (!thread) return json({ error: "Conversation not found" }, 404);
        const { data: board } = await supabase.from("boards").select("id,name").eq("id", boardId).maybeSingle();
        if (!board) return json({ error: "Board not found" }, 404);

        // Persist the latest user message
        const last = messages[messages.length - 1];
        if (last?.role === "user") {
          const { error } = await supabase.from("chat_messages").upsert(
            { thread_id: threadId, user_id: userId, message_id: last.id, role: "user", message: last as never },
            { onConflict: "thread_id,message_id" },
          );
          if (error) console.error("save user message", error);
          if (thread.title === "New chat") {
            const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
            if (text)
              await supabase
                .from("chat_threads")
                .update({ title: text.slice(0, 60), updated_at: new Date().toISOString() })
                .eq("id", threadId);
          }
        }

        const tools = {
          list_cards: tool({
            description: "List all cards on the current board with id, column status, title and description.",
            inputSchema: z.object({}),
            execute: async () => {
              const { data, error } = await supabase
                .from("cards")
                .select("id,status,title,description")
                .eq("board_id", boardId)
                .order("position");
              if (error) return { error: error.message };
              return { cards: data };
            },
          }),
          create_card: tool({
            description: "Create a new card on the board.",
            inputSchema: z.object({ title: z.string(), description: z.string().nullable(), status: statusEnum }),
            execute: async ({ title, description, status }) => {
              const { data: maxRow } = await supabase
                .from("cards")
                .select("position")
                .eq("board_id", boardId)
                .eq("status", status)
                .order("position", { ascending: false })
                .limit(1)
                .maybeSingle();
              const { data, error } = await supabase
                .from("cards")
                .insert({
                  board_id: boardId,
                  title,
                  description: description ?? "",
                  status,
                  position: (maxRow?.position ?? 0) + 1000,
                  created_by: userId,
                })
                .select("id,status,title")
                .single();
              return error ? { error: error.message } : { created: data };
            },
          }),
          update_card: tool({
            description: "Update a card's title and/or description. Pass null for fields to keep.",
            inputSchema: z.object({ id: z.string(), title: z.string().nullable(), description: z.string().nullable() }),
            execute: async ({ id, title, description }) => {
              const patch: { title?: string; description?: string } = {};
              if (title) patch.title = title;
              if (description !== null) patch.description = description;
              const { data, error } = await supabase
                .from("cards")
                .update(patch)
                .eq("id", id)
                .eq("board_id", boardId)
                .select("id,status,title")
                .single();
              return error ? { error: error.message } : { updated: data };
            },
          }),
          move_card: tool({
            description: "Move a card to another column (todo, in_progress, done). It goes to the bottom.",
            inputSchema: z.object({ id: z.string(), status: statusEnum }),
            execute: async ({ id, status }) => {
              const { data: maxRow } = await supabase
                .from("cards")
                .select("position")
                .eq("board_id", boardId)
                .eq("status", status)
                .order("position", { ascending: false })
                .limit(1)
                .maybeSingle();
              const { data, error } = await supabase
                .from("cards")
                .update({ status, position: (maxRow?.position ?? 0) + 1000 })
                .eq("id", id)
                .eq("board_id", boardId)
                .select("id,status,title")
                .single();
              return error ? { error: error.message } : { moved: data };
            },
          }),
          delete_card: tool({
            description: "Permanently delete a card. Only do this when the user clearly asks.",
            inputSchema: z.object({ id: z.string() }),
            execute: async ({ id }) => {
              const { error } = await supabase.from("cards").delete().eq("id", id).eq("board_id", boardId);
              return error ? { error: error.message } : { deleted: id };
            },
          }),
        };

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return json({ error: "AI is not configured." }, 500);
        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          instructions: `You are Pip, a friendly, concise project assistant inside a team kanban board app.
The current board is "${board.name}". Columns: todo (To Do), in_progress (In progress), done (Done).
Always call list_cards before answering questions about the board or before changing cards, so you use real card ids.
You can create, update, move and delete cards with tools. Confirm what you changed in a short sentence. Use markdown lightly.`,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(50),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages,
          sendReasoning: true,
          onFinish: async ({ responseMessage }) => {
            const { error } = await supabase.from("chat_messages").upsert(
              {
                thread_id: threadId,
                user_id: userId,
                message_id: responseMessage.id,
                role: "assistant",
                message: responseMessage as never,
              },
              { onConflict: "thread_id,message_id" },
            );
            if (error) console.error("save assistant message", error);
            await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
          },
          onError: (err) => {
            console.error("chat error", err);
            const msg = String((err as Error)?.message ?? err);
            if (msg.includes("402")) return "AI credits are used up. Please add credits to keep chatting.";
            if (msg.includes("429")) return "Too many requests right now — please wait a moment and try again.";
            return "Something went wrong talking to the assistant.";
          },
        });
        return withLovableAiGatewayRunIdHeader(response, runIdFetch);
      },
    },
  },
});
