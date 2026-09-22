const CALLBACK_TIMEOUT_MS = 5000;

export function getAuthCallbackError(location = globalThis.window?.location) {
  if (!location) return "";

  const hash = new URLSearchParams(String(location.hash || "").replace(/^#/, ""));
  const query = new URLSearchParams(String(location.search || ""));
  const value =
    hash.get("error_description") ||
    query.get("error_description") ||
    hash.get("error") ||
    query.get("error");

  if (!value) return "";
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value.replace(/\+/g, " ");
  }
}

export async function waitForAuthSession(supabase, timeoutMs = CALLBACK_TIMEOUT_MS) {
  const callbackError = getAuthCallbackError();
  if (callbackError) throw new Error(callbackError);

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.user) return data.session;

  return new Promise((resolve, reject) => {
    let settled = false;
    let subscription;
    let timer;

    const finish = (session, sessionError) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      subscription?.unsubscribe();
      if (sessionError) reject(sessionError);
      else resolve(session || null);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession?.user) finish(nextSession);
    });
    subscription = listener.subscription;

    timer = setTimeout(async () => {
      try {
        const { data: latest, error: latestError } = await supabase.auth.getSession();
        finish(latest.session || null, latestError);
      } catch (latestError) {
        finish(null, latestError);
      }
    }, timeoutMs);
  });
}
