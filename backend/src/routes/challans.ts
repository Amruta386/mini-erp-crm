import { Router } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPagination, paginatedResponse } from "../utils/pagination";
import { assertSufficientStock, computeTotalQuantity, formatChallanNumber, InsufficientStockError } from "../utils/stockLogic";

const router = Router();
router.use(requireAuth);

const challanItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const createChallanSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(challanItemSchema).min(1),
  status: z.enum(["DRAFT", "CONFIRMED"]).optional(), // defaults to DRAFT
});

async function generateChallanNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.challan.count();
  return formatChallanNumber(year, count + 1);
}

// GET /challans - list with pagination + filters
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req);
    const status = req.query.status as string | undefined;
    const customerId = req.query.customerId as string | undefined;

    const where: any = {
      AND: [status ? { status } : {}, customerId ? { customerId } : {}],
    };

    const [data, total] = await Promise.all([
      prisma.challan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { customer: { select: { name: true, mobile: true } }, items: true },
      }),
      prisma.challan.count({ where }),
    ]);

    res.json(paginatedResponse(data, total, page, limit));
  })
);

// GET /challans/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const challan = await prisma.challan.findUnique({
      where: { id: req.params.id },
      include: { customer: true, items: true, createdBy: { select: { name: true } } },
    });
    if (!challan) throw new ApiError(404, "Challan not found");
    res.json(challan);
  })
);

// POST /challans - create as Draft or Confirmed (Admin, Sales)
router.post(
  "/",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const { customerId, items, status } = createChallanSchema.parse(req.body);
    const finalStatus = status || "DRAFT";

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new ApiError(404, "Customer not found");

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
    });
    if (products.length !== items.length) {
      throw new ApiError(400, "One or more products not found");
    }

    // If confirming immediately, validate stock BEFORE writing anything
    if (finalStatus === "CONFIRMED") {
      try {
        assertSufficientStock(
          items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            return { productId: product.id, productName: product.name, availableStock: product.stock, requestedQuantity: item.quantity };
          })
        );
      } catch (err) {
        if (err instanceof InsufficientStockError) throw new ApiError(400, err.message);
        throw err;
      }
    }

    const challanNumber = await generateChallanNumber();
    const totalQuantity = computeTotalQuantity(items);

    const challan = await prisma.$transaction(async (tx) => {
      const created = await tx.challan.create({
        data: {
          challanNumber,
          customerId,
          status: finalStatus,
          totalQuantity,
          createdById: req.user!.id,
          items: {
            create: items.map((item) => {
              const product = products.find((p) => p.id === item.productId)!;
              return {
                productId: product.id,
                productNameSnapshot: product.name,
                skuSnapshot: product.sku,
                unitPriceSnapshot: product.unitPrice,
                quantity: item.quantity,
              };
            }),
          },
        },
        include: { items: true },
      });

      if (finalStatus === "CONFIRMED") {
        for (const item of items) {
          const product = products.find((p) => p.id === item.productId)!;
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              quantity: item.quantity,
              movementType: "OUT",
              reason: `Sales challan ${challanNumber}`,
              createdById: req.user!.id,
            },
          });
        }
      }

      return created;
    });

    res.status(201).json(challan);
  })
);

// PATCH /challans/:id/confirm - confirm a draft challan (reduces stock)
router.patch(
  "/:id/confirm",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const challan = await prisma.challan.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!challan) throw new ApiError(404, "Challan not found");
    if (challan.status !== "DRAFT") throw new ApiError(400, `Cannot confirm a challan with status ${challan.status}`);

    const productIds = challan.items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

    try {
      assertSufficientStock(
        challan.items.map((item) => {
          const product = products.find((p) => p.id === item.productId)!;
          return { productId: product.id, productName: product.name, availableStock: product.stock, requestedQuantity: item.quantity };
        })
      );
    } catch (err) {
      if (err instanceof InsufficientStockError) throw new ApiError(400, err.message);
      throw err;
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of challan.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: "OUT",
            reason: `Sales challan ${challan.challanNumber}`,
            createdById: req.user!.id,
          },
        });
      }
      return tx.challan.update({ where: { id: challan.id }, data: { status: "CONFIRMED" }, include: { items: true, customer: true } });
    });

    res.json(updated);
  })
);

// PATCH /challans/:id/cancel - cancel a draft challan
router.patch(
  "/:id/cancel",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const challan = await prisma.challan.findUnique({ where: { id: req.params.id } });
    if (!challan) throw new ApiError(404, "Challan not found");
    if (challan.status === "CONFIRMED") {
      throw new ApiError(400, "Cannot cancel a confirmed challan directly — stock already deducted. Use a return process instead.");
    }
    const updated = await prisma.challan.update({ where: { id: challan.id }, data: { status: "CANCELLED" } });
    res.json(updated);
  })
);

// GET /challans/:id/pdf - generate a simple invoice/challan PDF on the fly
router.get(
  "/:id/pdf",
  asyncHandler(async (req, res) => {
    const challan = await prisma.challan.findUnique({
      where: { id: req.params.id },
      include: { customer: true, items: true, createdBy: { select: { name: true } } },
    });
    if (!challan) throw new ApiError(404, "Challan not found");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=${challan.challanNumber}.pdf`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text("Sales Challan", { align: "right" });
    doc.fontSize(10).fillColor("#555").text(challan.challanNumber, { align: "right" });
    doc.moveDown(1.5);

    doc.fillColor("#000").fontSize(12).text(`Customer: ${challan.customer.name}`);
    if (challan.customer.businessName) doc.text(`Business: ${challan.customer.businessName}`);
    doc.text(`Mobile: ${challan.customer.mobile}`);
    if (challan.customer.address) doc.text(`Address: ${challan.customer.address}`);
    doc.text(`Status: ${challan.status}`);
    doc.text(`Date: ${challan.createdAt.toDateString()}`);
    doc.text(`Prepared by: ${challan.createdBy.name}`);
    doc.moveDown();

    const tableTop = doc.y + 10;
    doc.font("Helvetica-Bold");
    doc.text("Product", 50, tableTop);
    doc.text("SKU", 250, tableTop);
    doc.text("Qty", 350, tableTop);
    doc.text("Unit Price", 410, tableTop);
    doc.text("Line Total", 480, tableTop);
    doc.moveTo(50, tableTop + 15).lineTo(560, tableTop + 15).stroke();
    doc.font("Helvetica");

    let y = tableTop + 25;
    let grandTotal = 0;
    for (const item of challan.items) {
      const lineTotal = item.quantity * Number(item.unitPriceSnapshot);
      grandTotal += lineTotal;
      doc.text(item.productNameSnapshot, 50, y, { width: 190 });
      doc.text(item.skuSnapshot, 250, y);
      doc.text(String(item.quantity), 350, y);
      doc.text(`Rs. ${Number(item.unitPriceSnapshot).toFixed(2)}`, 410, y);
      doc.text(`Rs. ${lineTotal.toFixed(2)}`, 480, y);
      y += 22;
    }

    doc.moveTo(50, y + 5).lineTo(560, y + 5).stroke();
    doc.font("Helvetica-Bold").text(`Grand Total: Rs. ${grandTotal.toFixed(2)}`, 400, y + 15);

    doc.end();
  })
);

export default router;
