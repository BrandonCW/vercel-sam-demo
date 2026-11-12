import { eveChannel } from "eve/channels/eve";
import { ForbiddenError, type AuthFn } from "eve/channels/auth";
import { EVE_CHANNEL_AUTH } from "@/lib/eve-auth";

/**
 * CSRF guard for state-changing requests (POST/PUT/PATCH/DELETE): when an `Origin` header is
 * present, its host must match `X-Forwarded-Host` / `Host` / `request.url`. Callers without an
 * `Origin` header (CLI, TUI, server-side evals) pass through to the channel auth walk.
 */
export const csrfOriginGuard: AuthFn<Request> = (request) => {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw new ForbiddenError({ message: "Cross-origin request rejected: invalid Origin header." });
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const rawHost = forwardedHost || request.headers.get("host")?.trim();
  let expectedHost = rawHost?.toLowerCase() ?? "";
  if (!expectedHost) {
    try {
      expectedHost = new URL(request.url).host.toLowerCase();
    } catch {
      expectedHost = "";
    }
  }

  if (!originHost || !expectedHost || originHost !== expectedHost) {
    throw new ForbiddenError({ message: "Cross-origin request rejected." });
  }

  return null;
};

export const EVE_CHANNEL_AUTH_WITH_CSRF: AuthFn<Request>[] = [csrfOriginGuard, ...EVE_CHANNEL_AUTH];

export default eveChannel({
  auth: EVE_CHANNEL_AUTH_WITH_CSRF,
});
