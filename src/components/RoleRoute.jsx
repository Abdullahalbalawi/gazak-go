import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

const ROLE_HOMES = {
  customer: "/",
  distributor: "/distributor",
  driver: "/driver",
  admin: "/admin",
};

export default function RoleRoute({ allowedRoles, allowUnauthenticated = false, children }) {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return allowUnauthenticated ? children : <Navigate to="/login" replace />;
  }

  const role = user?.role || "customer";

  if (!allowedRoles.includes(role)) {
    return <Navigate to={ROLE_HOMES[role] || "/"} replace />;
  }

  return children;
}