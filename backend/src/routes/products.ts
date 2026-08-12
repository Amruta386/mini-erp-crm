import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPagination, paginatedResponse } from "../utils/pagination";

const router = Router();
router.use(requireAuth);

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().optional().nullable(),
  unitPrice: z.number().nonnegative(),
  stock: z.number().int().nonnegative().optional(),
  minStock: z.number().int().nonnegative().optional(),
  location: z.string().optional().nullable(),
});

// GET /products - list with search + pagination + low-stock filter
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req);
    const search = (req.query.search as string) || "";
    const lowStock = req.query.lowStock === "true";

    const where: any = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };

    let data = await prisma.product.findMany({ where, orderBy: { createdAt: "desc" } });
    if (lowStock) data = data.filter((p) => p.stock <= p.minStock);

    const total = data.length;
    const paged = data.slice(skip, skip + limit);
    res.json(paginatedResponse(paged, total, page, limit));
  })
);

// GET /products/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { stockMovements: { orderBy: { createdAt: "desc" }, take: 20, include: { createdBy: { select: { name: true } } } } },
    });
    if (!product) throw new ApiError(404, "Product not found");
    res.json(product);
  })
);

// POST /products - create (Admin, Warehouse)
router.post(
  "/",
  requireRole("ADMIN", "WAREHOUSE"),
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({ data });
    res.status(201).json(product);
  })
);

// PUT /products/:id - edit basic info (not stock directly)
router.put(
  "/:id",
  requireRole("ADMIN", "WAREHOUSE"),
  asyncHandler(async (req, res) => {
    const data = productSchema.partial().omit({ stock: true }).parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    res.json(product);
  })
);

// POST /products/:id/stock-movement - adjust stock, logs movement
router.post(
  "/:id/stock-movement",
  requireRole("ADMIN", "WAREHOUSE"),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      quantity: z.number().int().positive(),
      movementType: z.enum(["IN", "OUT"]),
      reason: z.string().min(1),
    });
    const { quantity, movementType, reason } = schema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) throw new ApiError(404, "Product not found");

    const newStock = movementType === "IN" ? product.stock + quantity : product.stock - quantity;
    if (newStock < 0) throw new ApiError(400, "Stock cannot go negative");

    const [, movement] = await prisma.$transaction([
      prisma.product.update({ where: { id: product.id }, data: { stock: newStock } }),
      prisma.stockMovement.create({
        data: {
          productId: product.id,
          quantity,
          movementType,
          reason,
          createdById: req.user!.id,
        },
      }),
    ]);

    res.status(201).json(movement);
  })
);

export default router;
