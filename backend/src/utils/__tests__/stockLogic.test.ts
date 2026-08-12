import {
  assertSufficientStock,
  computeNewStock,
  computeTotalQuantity,
  formatChallanNumber,
  InsufficientStockError,
} from "../stockLogic";

describe("assertSufficientStock", () => {
  it("does not throw when stock is exactly enough", () => {
    expect(() =>
      assertSufficientStock([{ productId: "p1", productName: "Paper Ream", availableStock: 5, requestedQuantity: 5 }])
    ).not.toThrow();
  });

  it("does not throw when stock has surplus", () => {
    expect(() =>
      assertSufficientStock([{ productId: "p1", productName: "Paper Ream", availableStock: 100, requestedQuantity: 5 }])
    ).not.toThrow();
  });

  it("throws InsufficientStockError when requested exceeds available", () => {
    expect(() =>
      assertSufficientStock([{ productId: "p1", productName: "Paper Ream", availableStock: 3, requestedQuantity: 5 }])
    ).toThrow(InsufficientStockError);
  });

  it("error message includes product name, available, and requested quantities", () => {
    try {
      assertSufficientStock([{ productId: "p1", productName: "Paper Ream", availableStock: 3, requestedQuantity: 5 }]);
      fail("expected assertSufficientStock to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientStockError);
      expect((err as InsufficientStockError).message).toContain("Paper Ream");
      expect((err as InsufficientStockError).message).toContain("Available: 3");
      expect((err as InsufficientStockError).message).toContain("requested: 5");
    }
  });

  it("checks every line item, not just the first — fails on the second item if it's short", () => {
    expect(() =>
      assertSufficientStock([
        { productId: "p1", productName: "Paper Ream", availableStock: 100, requestedQuantity: 5 },
        { productId: "p2", productName: "Stapler", availableStock: 2, requestedQuantity: 10 },
      ])
    ).toThrow(/Stapler/);
  });

  it("rejects a zero or negative requested quantity", () => {
    expect(() =>
      assertSufficientStock([{ productId: "p1", productName: "Paper Ream", availableStock: 10, requestedQuantity: 0 }])
    ).toThrow();
  });
});

describe("computeNewStock", () => {
  it("adds quantity for an IN movement", () => {
    expect(computeNewStock(10, 5, "IN")).toBe(15);
  });

  it("subtracts quantity for an OUT movement", () => {
    expect(computeNewStock(10, 5, "OUT")).toBe(5);
  });

  it("allows stock to reach exactly zero", () => {
    expect(computeNewStock(5, 5, "OUT")).toBe(0);
  });

  it("returns null instead of allowing stock to go negative", () => {
    expect(computeNewStock(5, 10, "OUT")).toBeNull();
  });
});

describe("computeTotalQuantity", () => {
  it("sums quantities across line items", () => {
    expect(computeTotalQuantity([{ quantity: 2 }, { quantity: 3 }, { quantity: 5 }])).toBe(10);
  });

  it("returns 0 for an empty item list", () => {
    expect(computeTotalQuantity([])).toBe(0);
  });
});

describe("formatChallanNumber", () => {
  it("formats with a 5-digit zero-padded sequence", () => {
    expect(formatChallanNumber(2026, 1)).toBe("CH-2026-00001");
  });

  it("does not truncate a sequence longer than 5 digits", () => {
    expect(formatChallanNumber(2026, 123456)).toBe("CH-2026-123456");
  });
});
