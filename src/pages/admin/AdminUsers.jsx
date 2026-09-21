import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import StaffHeader from "@/components/StaffHeader";
import AddUserDialog from "@/components/AddUserDialog";
import UserDetailDialog from "@/components/UserDetailDialog";
import { Loader2, User, Mail, Phone, UserPlus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const ROLES = [
  { value: "customer", label: "عميل" },
  { value: "distributor", label: "موزع" },
  { value: "driver", label: "سائق" },
  { value: "admin", label: "إدارة" },
];

const ROLE_BADGE = {
  customer: "bg-blue-100 text-blue-700",
  distributor: "bg-purple-100 text-purple-700",
  driver: "bg-orange-100 text-orange-700",
  admin: "bg-green-100 text-green-700",
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      const list = await base44.entities.User.list("-created_date", 200);
      setUsers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUserUpdated = (updated) => {
    if (updated === null) return;
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...updated } : u)));
    setSelectedUser(updated);
  };

  const handleUserDeleted = (deletedId) => {
    setUsers((prev) => prev.filter((u) => u.id !== deletedId));
    setSelectedUser(null);
  };

  const handleUserDone = (updated, deletedId) => {
    if (deletedId) {
      handleUserDeleted(deletedId);
    } else if (updated) {
      handleUserUpdated(updated);
    } else {
      fetchUsers();
    }
  };

  const openDetail = (u) => {
    setSelectedUser(u);
    setDetailOpen(true);
  };

  const filtered = filter === "all" ? users : users.filter((u) => (u.role || "customer") === filter);

  const counts = {
    all: users.length,
    customer: users.filter((u) => (u.role || "customer") === "customer").length,
    distributor: users.filter((u) => u.role === "distributor").length,
    driver: users.filter((u) => u.role === "driver").length,
    admin: users.filter((u) => u.role === "admin").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <StaffHeader title="المستخدمون" />
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* زر إضافة مستخدم */}
        <button
          onClick={() => setAddOpen(true)}
          className="w-full mb-4 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90"
        >
          <UserPlus className="w-5 h-5" />
          إضافة مستخدم
        </button>

        {/* فلتر الأدوار */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-white border border-border text-muted-foreground"}`}
          >
            الكل ({counts.all})
          </button>
          {ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => setFilter(r.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${filter === r.value ? "bg-primary text-primary-foreground" : "bg-white border border-border text-muted-foreground"}`}
            >
              {r.label} ({counts[r.value]})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">لا يوجد مستخدمون</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => {
              const role = u.role || "customer";
              const badge = ROLE_BADGE[role] || "bg-gray-100 text-gray-700";
              const active = u.active !== false;
              return (
                <button
                  key={u.id}
                  onClick={() => openDetail(u)}
                  className="w-full text-right bg-white rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{u.full_name || "بدون اسم"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3" />
                          {u.email}
                        </p>
                        {u.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {u.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge}`}>
                        {ROLES.find((r) => r.value === role)?.label || role}
                      </span>
                      {!active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                          متوقف
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} onDone={fetchUsers} />
      <UserDetailDialog
        user={selectedUser}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDone={handleUserDone}
      />
    </div>
  );
}