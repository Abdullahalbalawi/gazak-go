import React, { useState, useEffect } from "react";
import { supabaseApi } from "@/lib/supabaseApi";
import { STATUS_LABELS_AR } from "@/lib/orderStatus";
import { History } from "lucide-react";

export default function OrderHistoryTimeline({ orderId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const list = await supabaseApi.entities.OrderHistory.filter(
          { order_id: orderId },
          "created_date",
          50
        );
        setHistory(list);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [orderId]);

  if (loading || history.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-border p-4 mb-3">
      <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-1.5">
        <History className="w-4 h-4 text-muted-foreground" />
        سجل الحركة
      </h3>
      <div className="space-y-2.5">
        {history.map((h) => (
          <div key={h.id} className="flex items-start gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">
                  {STATUS_LABELS_AR[h.new_status] || h.new_status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(h.created_date).toLocaleString("ar-SA")}
                </span>
              </div>
              {h.performed_by_name && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  بواسطة: {h.performed_by_name}
                  {h.performed_by_role && h.performed_by_role !== "customer" && ` (${h.performed_by_role})`}
                </p>
              )}
              {h.note && (
                <p className="text-xs text-muted-foreground mt-1 bg-muted rounded-lg px-2 py-1">
                  {h.note}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}