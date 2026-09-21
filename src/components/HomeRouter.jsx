import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import CustomerHome from "@/pages/customer/CustomerHome";

const STAFF_REDIRECTS = {
  distributor: "/distributor",
  driver: "/driver",
  admin: "/admin",
};

export default function HomeRouter() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user && STAFF_REDIRECTS[user.role]) {
      navigate(STAFF_REDIRECTS[user.role], { replace: true });
    }
  }, [isAuthenticated, user]);

  if (isAuthenticated && user && STAFF_REDIRECTS[user.role]) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return <CustomerHome />;
}