import React from "react";
import { STATUS_LABELS_AR, STATUS_BADGE_STYLES } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";

export default function StatusBadge({ status, className }) {
  const label = STATUS_LABELS_AR[status] || status;
  const style = STATUS_BADGE_STYLES[status] || "bg-gray-100 text-gray-700";
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold",
        style,
        className
      )}
    >
      {label}
    </span>
  );
}