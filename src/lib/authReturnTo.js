// Shared by the auth pages (Login, Register, and any page that resumes a flow
// after sign-in, e.g. the MCP OAuth consent page). Keep the redirect
// validation in one place — it is security-sensitive and easy to drift.

export function safeReturnTo(
  search = globalThis.window?.location?.search ?? "",
  origin = globalThis.window?.location?.origin ?? "http://localhost",
) {
  const raw = new URLSearchParams(search).get("returnTo");
  if (!raw) return "/";
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return "/";
    for (const p of ["access_token", "clear_access_token", "app_id", "app_base_url", "functions_version", "from_url"]) {
      url.searchParams.delete(p);
    }
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
    return path;
  } catch {
    return "/";
  }
}

export function appUrl(
  path = "/",
  origin = globalThis.window?.location?.origin ?? "http://localhost",
  basePath = import.meta.env?.BASE_URL ?? "/",
) {
  const baseUrl = new URL(basePath, origin);
  const relativePath = String(path || "/").replace(/^\/+/, "");
  return new URL(relativePath, baseUrl).href;
}
