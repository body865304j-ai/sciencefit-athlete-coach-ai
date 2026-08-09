/**
 * Maps Supabase auth errors to user-safe copy.
 *
 * Never surface raw provider messages: they can leak whether an account
 * exists, internal rate-limit details, or provider configuration.
 */
export function authErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const text = `${code} ${raw}`.toLowerCase();

  if (text.includes("invalid login credentials") || text.includes("invalid_credentials")) {
    return "That email and password don't match. Check your details and try again.";
  }
  if (text.includes("email not confirmed") || text.includes("email_not_confirmed")) {
    return "Confirm your email first — check your inbox for the ScienceFit link.";
  }
  if (text.includes("user already registered") || text.includes("user_already_exists")) {
    return "An account already exists for this email. Sign in instead.";
  }
  if (text.includes("weak_password") || text.includes("known to be weak")) {
    return "That password appears in known breach lists. Choose a stronger, unique password.";
  }
  if (text.includes("password should be") || text.includes("password_too_short")) {
    return "Use a longer password — at least 8 characters.";
  }
  if (text.includes("invalid email") || text.includes("email_address_invalid")) {
    return "Enter a valid email address.";
  }
  if (text.includes("signup") && text.includes("disabled")) {
    return "New sign-ups are currently closed.";
  }
  if (text.includes("over_email_send_rate_limit") || text.includes("rate limit")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (text.includes("failed to fetch") || text.includes("network")) {
    return "Network problem — check your connection and try again.";
  }
  if (text.includes("session") && text.includes("expired")) {
    return "Your session expired. Sign in again.";
  }
  return "We couldn't complete that request. Please try again.";
}

/** Only allow same-origin, non-auth paths as post-login destinations. */
export function safeRedirect(target: unknown, fallback = "/app"): string {
  if (typeof target !== "string") return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  if (target.startsWith("/auth")) return fallback;
  return target;
}
