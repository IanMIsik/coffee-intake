import { Prisma } from "@prisma/client";
import { prisma } from "../db";

type Tx = Prisma.TransactionClient;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ZERO = D(0);

export class SettlementError extends Error {
  status = 400;
}

export function amountFor(weightKg: Prisma.Decimal, pricePerKg: Prisma.Decimal | null): Prisma.Decimal | null {
  return pricePerKg ? weightKg.times(pricePerKg).toDecimalPlaces(2) : null;
}

/** Locks the rows so two admins recording payments at once can't both spend the same kilos. */
export async function lockReceipts(tx: Tx, ids: string[]) {
  if (ids.length === 0) return;
  await tx.$queryRaw`SELECT id FROM "Receipt" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;
}

/** Re-derives a receipt's paid kilos and settled flag from its non-voided payments. */
export async function recomputeReceipt(tx: Tx, receiptId: string) {
  const receipt = await tx.receipt.findUniqueOrThrow({ where: { id: receiptId } });
  const live = await tx.settlement.findMany({ where: { receiptId, voidedAt: null } });
  const settledKg = live.reduce((sum, s) => sum.plus(s.weightKg), ZERO);
  const settled = settledKg.gte(receipt.weightKg);
  const last = live.length ? live.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)) : null;
  return tx.receipt.update({
    where: { id: receiptId },
    data: {
      settledKg,
      settled,
      settledAt: settled && last ? last.createdAt : null,
      settledByStaffId: settled && last ? last.recordedByStaffId : null,
    },
  });
}

/** Records a payment for `weightKg` of one delivery. The caller must have locked the receipt. */
export async function payForReceipt(
  tx: Tx,
  input: {
    receiptId: string;
    weightKg: Prisma.Decimal;
    pricePerKg: Prisma.Decimal | null;
    note?: string;
    staffId: string;
    batchId?: string | null;
  }
) {
  const receipt = await tx.receipt.findUniqueOrThrow({ where: { id: input.receiptId } });
  const remaining = receipt.weightKg.minus(receipt.settledKg);
  if (input.weightKg.lte(ZERO)) throw new SettlementError("Kilos must be greater than 0");
  if (input.weightKg.gt(remaining)) {
    throw new SettlementError(
      `Only ${remaining.toFixed(2)} kg of receipt ${receipt.receiptNumber} is still unpaid`
    );
  }
  const price = input.pricePerKg ?? receipt.pricePerKg;
  const settlement = await tx.settlement.create({
    data: {
      organizationId: receipt.organizationId,
      receiptId: receipt.id,
      farmerId: receipt.farmerId,
      weightKg: input.weightKg,
      pricePerKg: price,
      amount: amountFor(input.weightKg, price),
      note: input.note ?? null,
      batchId: input.batchId ?? null,
      recordedByStaffId: input.staffId,
    },
  });
  await recomputeReceipt(tx, receipt.id);
  return settlement;
}

const sum = (v: Prisma.Decimal | null | undefined) => (v ? v.toString() : "0");

/** Everything a farmer is owed, from one pass over their deliveries and payments. */
export async function farmerBalance(organizationId: string, farmerId: string) {
  const [recv] = await prisma.$queryRaw<
    {
      delivered: Prisma.Decimal | null;
      settled: Prisma.Decimal | null;
      unsettled: Prisma.Decimal | null;
      owed: Prisma.Decimal | null;
      unpriced: Prisma.Decimal | null;
    }[]
  >`
    SELECT SUM("weightKg") AS delivered,
           SUM("settledKg") AS settled,
           SUM("weightKg" - "settledKg") AS unsettled,
           SUM(("weightKg" - "settledKg") * "pricePerKg") FILTER (WHERE "pricePerKg" IS NOT NULL) AS owed,
           SUM("weightKg" - "settledKg") FILTER (WHERE "pricePerKg" IS NULL) AS unpriced
    FROM "Receipt"
    WHERE "organizationId" = ${organizationId} AND "farmerId" = ${farmerId}
  `;
  const paid = await prisma.settlement.aggregate({
    where: { organizationId, farmerId, voidedAt: null },
    _sum: { amount: true },
  });
  return {
    deliveredKg: sum(recv?.delivered),
    settledKg: sum(recv?.settled),
    unsettledKg: sum(recv?.unsettled),
    amountOwed: D(sum(recv?.owed)).toDecimalPlaces(2).toString(),
    unpricedKg: sum(recv?.unpriced),
    amountPaid: sum(paid._sum.amount),
  };
}
