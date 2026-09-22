import test from "node:test";
import assert from "node:assert/strict";
import { appUrl, safeReturnTo } from "../src/lib/authReturnTo.js";
import { isRoleAllowed, roleHome, VALID_ROLES } from "../src/lib/roles.js";

test("appUrl keeps callbacks inside the GitHub Pages base path", () => {
  assert.equal(
    appUrl("/accept-invite", "https://abdullahalbalawi.github.io", "/gazak-go/"),
    "https://abdullahalbalawi.github.io/gazak-go/accept-invite",
  );
  assert.equal(
    appUrl("/confirm-email", "https://abdullahalbalawi.github.io", "/gazak-go/"),
    "https://abdullahalbalawi.github.io/gazak-go/confirm-email",
  );
});

test("safeReturnTo accepts same-origin paths and rejects external redirects", () => {
  const origin = "https://abdullahalbalawi.github.io";
  assert.equal(safeReturnTo("?returnTo=%2Fadmin%2Fusers", origin), "/admin/users");
  assert.equal(safeReturnTo("?returnTo=https%3A%2F%2Fevil.example%2Fx", origin), "/");
  assert.equal(safeReturnTo("?returnTo=%2F%2Fevil.example", origin), "/");
});

test("only the four application roles are valid and each has a safe home", () => {
  assert.deepEqual(VALID_ROLES, ["customer", "distributor", "driver", "admin"]);
  assert.equal(roleHome("customer"), "/");
  assert.equal(roleHome("distributor"), "/distributor");
  assert.equal(roleHome("driver"), "/driver");
  assert.equal(roleHome("admin"), "/admin");
  assert.equal(roleHome("unknown"), "/login");
  assert.equal(isRoleAllowed("admin", ["admin"]), true);
  assert.equal(isRoleAllowed("customer", ["admin"]), false);
  assert.equal(isRoleAllowed("unknown", ["unknown"]), false);
});
