import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { isRoleAllowed, roleHome } from "@/lib/roles";

export default function RoleRoute({ allowedRoles, allowUnauthenticated = false, children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (allowUnauthenticated) return children;

    const returnTo = location.pathname + location.search + location.hash;
    const loginPath = "/login?returnTo=" + encodeURIComponent(returnTo || "/");
    return <Navigate to={loginPath} replace />;
  }

  const role = user?.role;

  if (!isRoleAllowed(role, allowedRoles)) {
    return <Navigate to={roleHome(role)} replace />;
  }

  return children;
}
