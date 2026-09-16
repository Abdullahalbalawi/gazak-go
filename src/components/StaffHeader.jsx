import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const ROLE_LABELS = {
  distributor: "لوحة الموزع",
  driver: "لوحة السائق",
  admin: "لوحة الإدارة",
};

const NAV_BY_ROLE = {
  distributor: [
    { to: "/distributor", label: "الطلبات" },
    { to: "/distributor/custody", label: "عهدتي" },
  ],
  driver: [{ to: "/driver", label: "طلباتي" }],
  admin: [
    { to: "/admin", label: "الرئيسية" },
    { to: "/admin/orders", label: "الطلبات" },
    { to: "/admin/products", label: "المنتجات" },
    { to: "/admin/inventory", label: "المخزون" },
    { to: "/admin/users", label: "المستخدمون" },
  ],
};

export default function StaffHeader({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const intervalRef = useRef(null);

  const role = user?.role || "customer";
  const nav = NAV_BY_ROLE[role] || [];

  const fetchUnread = async () => {
    try {
      const list = await base44.entities.Notification.filter({ user_id: user.id, read: false }, "-created_date", 50);
      setUnread(list.length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 15000);
    return () => clearInterval(intervalRef.current);
  }, [user?.id]);

  const handleLogout = () => {
    logout(false);
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {nav.length > 1 && (
            <button
              className="md:hidden p-1 -ml-1"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="القائمة"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
          <h1 className="font-bold text-base text-foreground">{title || ROLE_LABELS[role] || "لوحة التحكم"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/notifications" className="relative p-2 rounded-lg hover:bg-muted">
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1 left-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
      {nav.length > 1 && (
        <nav className="hidden md:flex border-t border-border px-4 max-w-3xl mx-auto">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-primary transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      {menuOpen && nav.length > 1 && (
        <nav className="md:hidden border-t border-border bg-white px-4 py-2">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className="block py-2 text-sm font-medium text-foreground hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}