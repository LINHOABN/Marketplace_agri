/** Libellés français des statuts de commande */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Payée / En attente",
  accepted: "Acceptée — En préparation",
  prepared: "Prête pour expédition",
  shipped: "En transit / En route",
  delivered: "Livrée",
  completed: "Transaction terminée",
  disputed: "En litige",
  cancelled: "Annulée",
};

export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || status;
}
