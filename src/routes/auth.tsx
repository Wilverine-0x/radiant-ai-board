import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/pip-logo.png";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Flowboard" },
      { name: "description", content: "Sign in to Flowboard to work on your team's kanban boards." },
      { property: "og:title", content: "Sign in — Flowboard" },
      { property: "og:description", content: "Sign in to Flowboard to work on your team's kanban boards." },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/";
  try {
    const u = new URL(p, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search : "/";
  } catch {
    return "/";
  }
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const done = () => navigate({ href: safePath(redirect) });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        done();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + safePath(redirect), data: { full_name: name } },
        });
        if (error) throw error;
        if (data.session) done();
        else toast.success("Check your email to confirm your account.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    sessionStorage.setItem("postAuth", safePath(redirect));
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return toast.error(String(result.error.message ?? result.error));
    if (result.redirected) return;
    done();
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-md rounded-[2rem] bg-card p-10 shadow-shell">
        <div className="mb-8 flex items-center gap-3">
          <img src={logo} alt="Flowboard" width={40} height={40} className="size-10" />
          <span className="font-display text-xl font-semibold">Flowboard</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Shared boards for your whole team, with Pip to help.</p>

        <Button variant="outline" className="mt-8 h-11 w-full rounded-full" onClick={google} type="button">
          Continue with Google
        </Button>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "up" && (
            <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          )}
          <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
          <Input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
          <Button disabled={busy} className="h-11 w-full rounded-full" type="submit">
            {mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
