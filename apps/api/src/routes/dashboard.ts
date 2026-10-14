import { Router } from "express";
import { prisma } from "../db";
import { authOrgId, requireAuth, requireRole } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { addDays, isDateString, startOfDayIn, todayIn } from "../lib/dates";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireRole("ADMIN"));


dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const organizationId = authOrgId(req);
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
    const tz = org?.timezone ?? "Africa/Nairobi";

    // "Today" and every day in the chart are calendar days in the organization's own
    // time zone, so a 1am delivery in Kenya counts as that day, not the previous UTC day.
    const today = todayIn(tz);
    const startOfToday = startOfDayIn(today, tz);
    const startOfTomorrow = startOfDayIn(addDays(today, 1), tz);
    const startOfYesterday = startOfDayIn(addDays(today, -1), tz);

    // Default range: last 14 days through today. Both ends are inclusive dates.
    let fromStr = isDateString(req.query.from) ? req.query.from : addDays(today, -13);
    let toStr = isDateString(req.query.to) ? req.query.to : today;
    if (toStr < fromStr) [fromStr, toStr] = [toStr, fromStr];
    if (fromStr < addDays(toStr, -365)) fromStr = addDays(toStr, -365);
    const rangeFrom = startOfDayIn(fromStr, tz);
    const rangeToExclusive = startOfDayIn(addDays(toStr, 1), tz);

    const [
      totalFarmers,
      farmerAgg,
      todayAgg,
      yesterdayAgg,
      todayFarmerRows,
      unsettledAgg,
      rangeAgg,
      settledInRangeAgg,
      rangeFarmerCountRows,
      dailyRows,
      topFarmerRows,
      unsettledFarmerRows,
    ] = await Promise.all([
      prisma.farmer.count({ where: { organizationId } }),
      prisma.farmer.aggregate({ where: { organizationId }, _sum: { cumulativeWeightKg: true } }),
      prisma.receipt.aggregate({
        where: { organizationId, deliveredAt: { gte: startOfToday, lt: startOfTomorrow } },
        _sum: { weightKg: true },
        _count: true,
      }),
      prisma.receipt.aggregate({
        where: { organizationId, deliveredAt: { gte: startOfYesterday, lt: startOfToday } },
        _sum: { weightKg: true },
      }),
      prisma.$queryRaw<{ farmerCount: bigint }[]>`
        SELECT COUNT(DISTINCT "farmerId")::bigint AS "farmerCount"
        FROM "Receipt"
        WHERE "organizationId" = ${organizationId}
          AND "deliveredAt" >= ${startOfToday} AND "deliveredAt" < ${startOfTomorrow}
      `,
      prisma.receipt.aggregate({
        where: { organizationId, settled: false },
        _sum: { weightKg: true },
        _count: true,
      }),
      prisma.receipt.aggregate({
        where: { organizationId, deliveredAt: { gte: rangeFrom, lt: rangeToExclusive } },
        _sum: { weightKg: true },
        _count: true,
      }),
      prisma.receipt.aggregate({
        where: {
          organizationId,
          settled: true,
          deliveredAt: { gte: rangeFrom, lt: rangeToExclusive },
        },
        _sum: { weightKg: true },
      }),
      prisma.$queryRaw<{ farmerCount: bigint }[]>`
        SELECT COUNT(DISTINCT "farmerId")::bigint AS "farmerCount"
        FROM "Receipt"
        WHERE "organizationId" = ${organizationId}
          AND "deliveredAt" >= ${rangeFrom} AND "deliveredAt" < ${rangeToExclusive}
      `,
      prisma.$queryRaw<{ date: string; totalKg: string; receiptCount: bigint; farmerCount: bigint }[]>`
        SELECT
          to_char(("deliveredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS date,
          COALESCE(SUM("weightKg"), 0)::text AS "totalKg",
          COUNT(*)::bigint AS "receiptCount",
          COUNT(DISTINCT "farmerId")::bigint AS "farmerCount"
        FROM "Receipt"
        WHERE "organizationId" = ${organizationId}
          AND "deliveredAt" >= ${rangeFrom} AND "deliveredAt" < ${rangeToExclusive}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw<{ farmerId: string; name: string; phone: string; totalKg: string }[]>`
        SELECT r."farmerId" AS "farmerId", f.name AS name, f.phone AS phone, SUM(r."weightKg")::text AS "totalKg"
        FROM "Receipt" r
        JOIN "Farmer" f ON f.id = r."farmerId"
        WHERE r."organizationId" = ${organizationId}
          AND r."deliveredAt" >= ${rangeFrom} AND r."deliveredAt" < ${rangeToExclusive}
        GROUP BY r."farmerId", f.name, f.phone
        ORDER BY SUM(r."weightKg") DESC
        LIMIT 5
      `,
      prisma.$queryRaw<
        { farmerId: string; name: string; phone: string; unsettledKg: string; receiptCount: bigint }[]
      >`
        SELECT r."farmerId" AS "farmerId", f.name AS name, f.phone AS phone,
               SUM(r."weightKg")::text AS "unsettledKg", COUNT(*)::bigint AS "receiptCount"
        FROM "Receipt" r
        JOIN "Farmer" f ON f.id = r."farmerId"
        WHERE r."organizationId" = ${organizationId} AND r.settled = false
        GROUP BY r."farmerId", f.name, f.phone
        ORDER BY SUM(r."weightKg") DESC
        LIMIT 5
      `,
    ]);

    const rangeTotalKg = Number(rangeAgg._sum.weightKg ?? 0);
    const settledInRangeKg = Number(settledInRangeAgg._sum.weightKg ?? 0);

    res.json({
      today,
      timezone: tz,
      totalFarmers,
      totalKgAllTime: (farmerAgg._sum.cumulativeWeightKg ?? 0).toString(),
      todayKg: (todayAgg._sum.weightKg ?? 0).toString(),
      todayReceiptCount: todayAgg._count,
      todayFarmerCount: Number(todayFarmerRows[0]?.farmerCount ?? 0),
      yesterdayKg: (yesterdayAgg._sum.weightKg ?? 0).toString(),
      unsettledKgAllTime: (unsettledAgg._sum.weightKg ?? 0).toString(),
      unsettledReceiptCount: unsettledAgg._count,
      range: { from: fromStr, to: toStr },
      rangeTotals: {
        totalKg: rangeTotalKg.toFixed(2),
        receiptCount: rangeAgg._count,
        farmerCount: Number(rangeFarmerCountRows[0]?.farmerCount ?? 0),
        settledKg: settledInRangeKg.toFixed(2),
        unsettledKg: (rangeTotalKg - settledInRangeKg).toFixed(2),
      },
      dailyBreakdown: dailyRows.map((r) => ({
        date: r.date,
        totalKg: r.totalKg,
        receiptCount: Number(r.receiptCount),
        farmerCount: Number(r.farmerCount),
      })),
      topFarmersInRange: topFarmerRows.map((r) => ({
        farmerId: r.farmerId,
        name: r.name,
        phone: r.phone,
        totalKg: r.totalKg,
      })),
      unsettledFarmers: unsettledFarmerRows.map((r) => ({
        farmerId: r.farmerId,
        name: r.name,
        phone: r.phone,
        unsettledKg: r.unsettledKg,
        receiptCount: Number(r.receiptCount),
      })),
    });
  })
);

// One day, broken down farmer by farmer: "who brought what on this day".
dashboardRouter.get(
  "/day",
  asyncHandler(async (req, res) => {
    const organizationId = authOrgId(req);
    const dateParam = typeof req.query.date === "string" ? req.query.date : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { timezone: true } });
    const tz = org?.timezone ?? "Africa/Nairobi";
    if (!isDateString(dateParam)) {
      return res.status(400).json({ error: "Invalid date" });
    }
    const dayStart = startOfDayIn(dateParam, tz);
    const dayEnd = startOfDayIn(addDays(dateParam, 1), tz);

    const rows = await prisma.$queryRaw<
      {
        farmerId: string;
        name: string;
        phone: string;
        receiptCount: bigint;
        totalKg: string;
        settledKg: string;
      }[]
    >`
      SELECT r."farmerId" AS "farmerId", f.name AS name, f.phone AS phone,
             COUNT(*)::bigint AS "receiptCount",
             SUM(r."weightKg")::text AS "totalKg",
             COALESCE(SUM(r."weightKg") FILTER (WHERE r.settled), 0)::text AS "settledKg"
      FROM "Receipt" r
      JOIN "Farmer" f ON f.id = r."farmerId"
      WHERE r."organizationId" = ${organizationId}
        AND r."deliveredAt" >= ${dayStart} AND r."deliveredAt" < ${dayEnd}
      GROUP BY r."farmerId", f.name, f.phone
      ORDER BY SUM(r."weightKg") DESC
    `;

    const farmers = rows.map((r) => ({
      farmerId: r.farmerId,
      name: r.name,
      phone: r.phone,
      receiptCount: Number(r.receiptCount),
      totalKg: r.totalKg,
      settledKg: r.settledKg,
    }));
    const totalKg = farmers.reduce((sum, f) => sum + Number(f.totalKg), 0);
    const settledKg = farmers.reduce((sum, f) => sum + Number(f.settledKg), 0);

    res.json({
      date: dateParam,
      totalKg: totalKg.toFixed(2),
      settledKg: settledKg.toFixed(2),
      receiptCount: farmers.reduce((sum, f) => sum + f.receiptCount, 0),
      farmerCount: farmers.length,
      farmers,
    });
  })
);
