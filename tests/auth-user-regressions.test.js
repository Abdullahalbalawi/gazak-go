import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("signup resend preserves the confirmation callback", async () => {
  const source = await read("src/pages/Register.jsx");
  assert.match(source, /resend\([\s\S]*emailRedirectTo:\s*appUrl\("\/confirm-email"\)/);
});

test("password recovery waits for the callback session", async () => {
  const source = await read("src/pages/ResetPassword.jsx");
  assert.match(source, /waitForAuthSession\(supabase\)/);
});

test("user deletion calls the protected delete action", async () => {
  const clientSource = await read("src/lib/supabaseApi.js");
  const functionSource = await read("supabase/functions/admin-user/index.ts");

  assert.match(clientSource, /action:\s*"delete"/);
  assert.match(functionSource, /auth\.admin\.deleteUser\(userId\)/);
  assert.match(functionSource, /CANNOT_DELETE_SELF/);
});

test("edge functions accept the current userClaims id field", async () => {
  const functionSource = await read("supabase/functions/admin-user/index.ts");
  assert.match(functionSource, /userClaims\?\.id\s*\?\?\s*ctx\.userClaims\?\.sub/);
});
