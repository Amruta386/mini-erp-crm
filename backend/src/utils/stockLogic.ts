/**
 * Pure business-logic functions for stock/challan rules, kept free of Express/Prisma
 * so they can be unit tested in isolation. Routes call these instead of inlining the
 * logic, which is what makes them testable without spinning up a database.
 */

export interface StockCheckItem {
  productId: string;
  productName: string;
  availableStock: number;
  requestedQuantity: number;
}

export class InsufficientStockError extends Error {
  productName: string;
  available: number;
  requested: number;
  constructor(item: StockCheckItem) {
    super(`Insufficient stock for ${item.productName}. Available: ${item.availableStock}, requested: ${item.requestedQuantity}`);
    this.productName = item.productName;
    this.available = item.availableStock;
    this.requested = item.requestedQuantity;
  }
}

/**
 * Throws InsufficientStockError on the first item that doesn't have enough stock.
 * Used before confirming a challan (whether at creation or via the confirm endpoint)
 * so we never write a stock update that would go negative.
 */
export function assertSufficientStock(items: StockCheckItem[]): void {
  for (const item of items) {
    if (item.requestedQuantity <= 0) {
      throw new Error(`Requested quantity for ${item.productName} must be positive`);
    }
    if (item.availableStock < item.requestedQuantity) {
      throw new InsufficientStockError(item);
    }
  }
}

/**
 * Computes the new stock level for a single IN/OUT movement.
 * Returns null if the movement would take stock negative (caller decides how to handle).
 */
export function computeNewStock(currentStock: number, quantity: number, movementType: "IN" | "OUT"): number | null {
  const next = movementType === "IN" ? currentStock + quantity : currentStock - quantity;
  return next < 0 ? null : next;
}

/**
 * Total quantity across challan line items — used for the Challan.totalQuantity field.
 */
export function computeTotalQuantity(items: { quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

/**
 * Generates the next challan number given how many challans already exist this year.
 * Kept pure/testable; the route supplies the count from the DB.
 */
export function formatChallanNumber(year: number, sequence: number): string {
  return `CH-${year}-${String(sequence).padStart(5, "0")}`;
}
