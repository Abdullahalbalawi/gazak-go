import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { DEMO_MODE } from "@/lib/demoMode";
import { Flame, LogIn, LogOut, Bell } from "lucide-react";
import { useCart } from "@/lib/CartContext";

const ROLE_HOMES={customer:"/",distributor:"/distributor",driver:"/driver",admin:"/admin"};
const ROLE_LABELS={customer:"العميل",distributor:"الموزع",driver:"السائق",admin:"المدير"};

export default function CustomerHeader() {
  const { user, isAuthenticated, logout, switchDemoRole } = useAuth();
  const navigate = useNavigate();
  const { count } = useCart();
  const handleLogout = async () => { await logout(); navigate(DEMO_MODE ? "/" : "/login"); };
  const changeRole = (e) => { const next=e.target.value; if(!DEMO_MODE||!switchDemoRole)return; switchDemoRole(next); navigate(ROLE_HOMES[next]); };

  return <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-border">
    <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center"><Flame className="w-5 h-5 text-primary-foreground"/></div><span className="font-bold text-lg text-foreground">غازك</span></Link>
      <div className="flex items-center gap-1">
        {DEMO_MODE&&<select value={user?.role||"customer"} onChange={changeRole} className="h-9 max-w-[105px] rounded-lg border bg-white px-2 text-xs" aria-label="تبديل الدور التجريبي">{Object.entries(ROLE_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>}
        {isAuthenticated&&<Link to="/notifications" className="relative p-2 rounded-lg hover:bg-muted"><Bell className="w-5 h-5"/>{count>0&&<span className="sr-only">{count} منتجات في السلة</span>}</Link>}
        {isAuthenticated?<button onClick={handleLogout} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" aria-label="تسجيل الخروج"><LogOut className="w-5 h-5"/></button>:<Link to="/login" className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary hover:bg-muted rounded-lg"><LogIn className="w-4 h-4"/>دخول</Link>}
      </div>
    </div>
  </header>;
}
