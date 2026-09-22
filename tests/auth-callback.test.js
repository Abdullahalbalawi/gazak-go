import test from "node:test";
import assert from "node:assert/strict";
import { getAuthCallbackError, waitForAuthSession } from "../src/lib/authCallback.js";

test("callback errors are read from hash and decoded", () => {
  assert.equal(
    getAuthCallbackError({ hash: "#error_description=Link+has+expired", search: "" }),
    "Link has expired",
  );
});

test("an existing callback session is returned immediately", async () => {
  const session = { user: { id: "user-1" } };
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => { throw new Error("listener should not be used"); },
    },
  };
  assert.equal(await waitForAuthSession(supabase, 5), session);
});

test("a delayed callback session is accepted and listener is cleaned up", async () => {
  let callback;
  let unsubscribed = false;
  const session = { user: { id: "user-2" } };
  const supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: (next) => {
        callback = next;
        return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
      },
    },
  };
  const pending = waitForAuthSession(supabase, 100);
  await Promise.resolve();
  callback("SIGNED_IN", session);
  assert.equal(await pending, session);
  assert.equal(unsubscribed, true);
});
