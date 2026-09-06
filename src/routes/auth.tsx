import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { authErrorMessage, safeRedirect } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — ScienceFit" },
      {
        name: "description",
        content:
          "Sign in or create a ScienceFit account to post a training request or compete as a coach.",
      },
      { property: "og:title", content: "Sign in — ScienceFit" },
      {
        property: "og:description",
        content: "Access your ScienceFit athlete or coach account.",
      },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resendError, setResendError] = useState<string | null>(null);
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const destination = safeRedirect(search.redirect);

  // Authenticated users never sit on /auth — send them to the app instead of
  // the marketing page, which is what made successful logins look like no-ops.
  useEffect(() => {
    if (!loading && session) void navigate({ to: destination, replace: true });
  }, [loading, session, navigate, destination]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          // Email confirmation is enabled: the user is NOT signed in yet.
          setPendingEmail(parsed.data.email);
          setPassword("");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
      }
      // Session arrives via onAuthStateChange -> the effect above navigates.
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!pendingEmail) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: pendingEmail });
      if (error) throw error;
      toast.success("Confirmation email sent again.");
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    setFormError(null);
    const parsedEmail = z.string().trim().email().max(255).safeParse(email);
    if (!parsedEmail.success) {
      setFormError("Enter your email address first, then request a reset link.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      // Never reveal whether the address exists.
      toast.success("If that email has an account, a reset link is on its way.");
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  // Initial session probe / redirect in flight: don't flash the form.
  if (loading || session) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-5">
        <p className="text-data text-xs uppercase tracking-[0.34em] text-warm-gray" role="status">
          Checking your session…
        </p>
      </main>
    );
  }

  if (pendingEmail) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-16">
        <div className="glass w-full max-w-md rounded-xl p-8">
          <Link to="/" className="text-data text-[0.7rem] uppercase tracking-[0.34em] text-primary">
            ScienceFit
          </Link>
          <h1 className="mt-6 font-display text-3xl font-light text-foreground">
            Confirm your email
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground">{pendingEmail}</span>.
            Open it to activate your account, then sign in.
          </p>
          <button
            type="button"
            onClick={() => void resendConfirmation()}
            disabled={busy}
            className="tap-target mt-8 w-full rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {busy ? "Sending…" : "Resend confirmation email"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingEmail(null);
              setMode("signin");
            }}
            className="tap-target mt-4 w-full text-sm text-warm-gray underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-16">
      <div className="glass w-full max-w-md rounded-xl p-8">
        <Link to="/" className="text-data text-[0.7rem] uppercase tracking-[0.34em] text-primary">
          ScienceFit
        </Link>
        <h1 className="mt-6 font-display text-3xl font-light text-foreground">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to your athlete or coach account."
            : "You choose whether you compete or request after signing up."}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="tap-target mt-2 w-full rounded-md border border-input bg-muted px-4 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="tap-target mt-2 w-full rounded-md border border-input bg-muted px-4 text-sm text-foreground outline-none focus:border-primary"
            />
            {mode === "signup" && (
              <p className="mt-2 text-xs text-warm-gray">
                At least 8 characters. Breached passwords are rejected.
              </p>
            )}
          </div>

          {formError && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="tap-target w-full rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {busy ? "Working\u2026" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "signin" && (
          <button
            type="button"
            onClick={() => void sendPasswordReset()}
            disabled={busy}
            className="tap-target mt-4 w-full text-sm text-warm-gray underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
          >
            Forgot your password?
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setFormError(null);
          }}
          className="tap-target mt-4 w-full text-sm text-warm-gray underline-offset-4 hover:text-foreground hover:underline"
        >
          {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
