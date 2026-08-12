import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPagination, paginatedResponse } from "../utils/pagination";

const router = Router();
router.use(requireAuth);

const customerSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(6),
  email: z.string().email().optional().nullable(),
  businessName: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  customerType: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]),
  address: z.string().optional().nullable(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).optional(),
  followUpDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /customers - list with search + pagination
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req);
    const search = (req.query.search as string) || "";
    const status = req.query.status as string | undefined;

    const where: any = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { mobile: { contains: search } },
                { businessName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
        status ? { status } : {},
      ],
    };

    const [data, total] = await Promise.all([
      prisma.customer.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.customer.count({ where }),
    ]);

    res.json(paginatedResponse(data, total, page, limit));
  })
);

// GET /customers/:id - detail with follow-ups
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: { followUps: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } } },
    });
    if (!customer) throw new ApiError(404, "Customer not found");
    res.json(customer);
  })
);

// POST /customers - create (Admin, Sales)
router.post(
  "/",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const data = customerSchema.parse(req.body);
    const customer = await prisma.customer.create({
      data: { ...data, followUpDate: data.followUpDate ? new Date(data.followUpDate) : null },
    });
    res.status(201).json(customer);
  })
);

// PUT /customers/:id - edit (Admin, Sales)
router.put(
  "/:id",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const data = customerSchema.partial().parse(req.body);
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { ...data, followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined },
    });
    res.json(customer);
  })
);

// POST /customers/:id/followups - add follow-up note
router.post(
  "/:id/followups",
  requireRole("ADMIN", "SALES"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ note: z.string().min(1) });
    const { note } = schema.parse(req.body);

    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) throw new ApiError(404, "Customer not found");

    const followUp = await prisma.followUp.create({
      data: { customerId: req.params.id, note, createdById: req.user!.id },
    });
    res.status(201).json(followUp);
  })
);

export default router;
