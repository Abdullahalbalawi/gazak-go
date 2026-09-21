import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Flame, LogIn, LogOut, Bell } from "lucide-react";
import { useCart } from "@/lib/CartContext";

export default function CustomerHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { count } = useCart();

  const handleLogout = () => {
    logout(false);
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-border">
      <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">غازك</span>
        </Link>
        <div className="flex items-center gap-1">
          {isAuthenticated && (
            <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-muted">
              <Bell className="w-5 h-5" />
            </Link>
          )}
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary hover:bg-muted rounded-lg"
            >
              <LogIn className="w-4 h-4" />
              دخول
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}