export const TX_TYPE_LABELS = {
  RESTOCK: "تزويد",
  SALE: "بيع",
  RETURN: "مرتجع",
  EXCHANGE: "استبدال",
  TRANSFER_DISTRIBUTOR: "تحويل لموزع",
  TRANSFER_DRIVER: "تحويل لسائق",
  ADJUSTMENT: "تسوية",
  RESERVE: "حجز",
  RELEASE: "إلغاء حجز",
};

export const TX_TYPE_STYLES = {
  RESTOCK: "bg-green-100 text-green-700",
  SALE: "bg-blue-100 text-blue-700",
  RETURN: "bg-amber-100 text-amber-700",
  EXCHANGE: "bg-purple-100 text-purple-700",
  TRANSFER_DISTRIBUTOR: "bg-cyan-100 text-cyan-700",
  TRANSFER_DRIVER: "bg-indigo-100 text-indigo-700",
  ADJUSTMENT: "bg-gray-100 text-gray-700",
  RESERVE: "bg-orange-100 text-orange-700",
  RELEASE: "bg-red-100 text-red-700",
};

export const TX_TYPES = Object.keys(TX_TYPE_LABELS);