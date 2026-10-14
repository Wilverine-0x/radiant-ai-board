import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";

const SUGGESTIONS = ["What's in progress right now?", "Add a card to research competitors", "Move everything done-looking to Done"];

export function ChatWindow({ threadId, boardId, initialMessages }: { threadId: string; boardId: string; initialMessages: UIMessage[] }) {
  const qc = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
        },
        body: { threadId, boardId },
      }),
    [threadId, boardId],
  );
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "The assistant couldn't respond."),
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["cards", boardId] });
      qc.invalidateQueries({ queryKey: ["threads", boardId] });
      qc.invalidateQueries({ queryKey: ["thread", threadId] });
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 px-4">
          {messages.length === 0 && (
            <div className="space-y-2 pt-6">
              <p className="text-sm text-muted-foreground">Try asking:</p>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="block w-full rounded-2xl border bg-card px-4 py-3 text-left text-sm transition hover:border-brand hover:shadow-card">
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                {m.parts.map((p, i) => {
                  if (p.type === "text") return <MessageResponse key={i}>{p.text}</MessageResponse>;
                  if (p.type.startsWith("tool-")) {
                    const tp = p as Extract<typeof p, { type: `tool-${string}` }> & { state: never; input: unknown; output: unknown; errorText?: string };
                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader type={tp.type as never} state={tp.state} />
                        <ToolContent>
                          <ToolInput input={tp.input as never} />
                          <ToolOutput output={tp.output as never} errorText={tp.errorText} />
                        </ToolContent>
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer className="text-sm">Pip is thinking…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="p-4">
        <PromptInput onSubmit={({ text }) => send(text ?? "")} className="rounded-2xl">
          <PromptInputTextarea ref={textareaRef} placeholder="Ask Pip anything…" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
