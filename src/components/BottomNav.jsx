import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, ShoppingBag, ClipboardList } from "lucide-react";
import { useCart } from "@/lib/CartContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "الرئيسية", icon: Home },
  { to: "/cart", label: "السلة", icon: ShoppingBag, showCount: true },
  { to: "/my-orders", label: "طلباتي", icon: ClipboardList },
];

export default function BottomNav() {
  const location = useLocation();
  const { count } = useCart();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-border shadow-lg">
      <div className="max-w-md mx-auto flex items-stretch justify-around px-2">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-4 flex-1 relative transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {item.showCount && count > 0 && (
                  <span className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {count}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}