export const VALID_ROLES = Object.freeze(["customer", "distributor", "driver", "admin"]);

export const ROLE_HOMES = Object.freeze({
  customer: "/",
  distributor: "/distributor",
  driver: "/driver",
  admin: "/admin",
});

export function isValidRole(role) {
  return VALID_ROLES.includes(role);
}

export function isRoleAllowed(role, allowedRoles) {
  return isValidRole(role) && allowedRoles.includes(role);
}

export function roleHome(role) {
  return ROLE_HOMES[role] || "/login";
}
