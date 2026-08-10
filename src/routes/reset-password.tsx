import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — ScienceFit" },
      {
        name: "description",
        content: "Choose a new password for your ScienceFit athlete or coach account.",
      },
      { property: "og:title", content: "Set a new password — ScienceFit" },
      {
        property: "og:description",
        content: "Complete your ScienceFit password reset.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

const passwordSchema = z.string().min(8, "Use at least 8 characters.").max(128);

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Supabase delivers a recovery session via the URL fragment; the client
  // exchanges it before this resolves.
  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady("ok");
    });
    void supabase.auth.getSession().then(({ data: result }) => {
      if (!active) return;
      setReady(result.session ? "ok" : "invalid");
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check your password.");
      return;
    }
    if (password !== confirm) {
      setFormError("Both passwords must match.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      void navigate({ to: "/app", replace: true });
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-16">
      <div className="glass w-full max-w-md rounded-xl p-8">
        <Link to="/" className="text-data text-[0.7rem] uppercase tracking-[0.34em] text-primary">
          ScienceFit
        </Link>
        <h1 className="mt-6 font-display text-3xl font-light text-foreground">
          Set a new password
        </h1>

        {ready === "checking" && (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            Checking your reset link…
          </p>
        )}

        {ready === "invalid" && (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Link
              to="/auth"
              className="tap-target mt-8 inline-flex w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
            >
              Back to sign in
            </Link>
          </>
        )}

        {ready === "ok" && (
          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="tap-target mt-2 w-full rounded-md border border-input bg-muted px-4 text-sm text-foreground outline-none focus:border-primary"
              />
              <p className="mt-2 text-xs text-warm-gray">
                At least 8 characters. Breached passwords are rejected.
              </p>
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-foreground">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="tap-target mt-2 w-full rounded-md border border-input bg-muted px-4 text-sm text-foreground outline-none focus:border-primary"
              />
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
              {busy ? "Saving\u2026" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
