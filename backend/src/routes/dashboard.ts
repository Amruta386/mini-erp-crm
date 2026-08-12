import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// GET /dashboard/summary - counts and alerts for the landing screen
router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalCustomers,
      leadCustomers,
      activeCustomers,
      totalProducts,
      allProducts,
      draftChallans,
      confirmedToday,
      confirmedThisMonthItems,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { status: "LEAD" } }),
      prisma.customer.count({ where: { status: "ACTIVE" } }),
      prisma.product.count(),
      prisma.product.findMany({ select: { stock: true, minStock: true } }),
      prisma.challan.count({ where: { status: "DRAFT" } }),
      prisma.challan.count({ where: { status: "CONFIRMED", createdAt: { gte: startOfDay } } }),
      prisma.challanItem.findMany({
        where: { challan: { status: "CONFIRMED", createdAt: { gte: startOfMonth } } },
        select: { quantity: true, unitPriceSnapshot: true },
      }),
    ]);

    const lowStockCount = allProducts.filter((p) => p.stock <= p.minStock).length;
    const revenueThisMonth = confirmedThisMonthItems.reduce(
      (sum, item) => sum + item.quantity * Number(item.unitPriceSnapshot),
      0
    );

    res.json({
      customers: { total: totalCustomers, leads: leadCustomers, active: activeCustomers },
      products: { total: totalProducts, lowStock: lowStockCount },
      challans: { drafts: draftChallans, confirmedToday },
      revenueThisMonth,
    });
  })
);

export default router;
