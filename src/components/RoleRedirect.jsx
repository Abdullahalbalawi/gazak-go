import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

// يوجه المستخدم لصفحة دوره بعد تسجيل الدخول
export default function RoleRedirect() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth || !user) return null;

  const role = user.role || "customer";

  switch (role) {
    case "distributor":
      return <Navigate to="/distributor" replace />;
    case "driver":
      return <Navigate to="/driver" replace />;
    case "admin":
      return <Navigate to="/admin" replace />;
    default:
      return <Navigate to="/" replace />;
  }
}
