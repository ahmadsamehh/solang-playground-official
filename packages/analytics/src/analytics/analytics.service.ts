import { Injectable } from "@nestjs/common";
import { Prisma, TransactionType } from "@prisma/client";
import { PrismaService } from "prisma/prisma.service";
import { RecordDeployDto, RecordInvokeDto } from "./analytics.dto";
import { fillMissingTimeUnits } from "src/libs/utils";
import { ActivityOverTimeType } from "src/libs/types";
import {
  fillBuckets,
  Granularity,
  RangeKey,
  ResolvedRange,
  resolveRange,
  truncateUtc,
} from "src/libs/range";
import { ActivitySort, SortOrder, toCsv } from "src/libs/params";

export interface ActivityFilters {
  type?: TransactionType;
  wallet?: string;
  q?: string;
  sort: ActivitySort;
  order: SortOrder;
}

interface PeriodTotals {
  deploys: number;
  invokes: number;
  users: number;
  contracts: number;
  invokedContracts: number;
}

export interface Kpi {
  value: number;
  /** Same metric over the previous period of equal length; null for "all". */
  previous: number | null;
  /** Percentage change vs previous; null when there is no meaningful baseline. */
  changePct: number | null;
  sparkline: number[];
}

const EXPORT_LIMIT = 50_000;

const round1 = (value: number) => Math.round(value * 10) / 10;

function kpi(value: number, previous: number | null, sparkline: number[]): Kpi {
  let changePct: number | null = null;
  if (previous !== null) {
    if (previous > 0) changePct = round1(((value - previous) / previous) * 100);
    else if (value === 0) changePct = 0;
  }
  return { value, previous, changePct, sparkline };
}

const avgPerContract = (
  t: Pick<PeriodTotals, "invokes" | "invokedContracts">,
) => (t.invokedContracts > 0 ? round1(t.invokes / t.invokedContracts) : 0);

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async recordDeployment({ wallet, address, name, txHash }: RecordDeployDto) {
    const contract = await this.prisma.contract.create({
      data: {
        address,
        name,
        deployedBy: {
          connectOrCreate: {
            where: { wallet },
            create: { wallet },
          },
        },
      },
    });

    await this.prisma.transaction.create({
      data: {
        type: TransactionType.DEPLOY,
        hash: txHash,
        contractId: contract.id,
        userId: contract.deployedById,
      },
    });

    return contract;
  }

  async recordInvoke({ wallet, address, method, txHash }: RecordInvokeDto) {
    const user = await this.prisma.user.upsert({
      where: { wallet: wallet },
      update: {},
      create: { wallet: wallet },
    });
    const contract = await this.prisma.contract.upsert({
      where: { address: address },
      update: {},
      create: { address: address, deployedById: user.id },
    });
    const transaction = await this.prisma.transaction.create({
      data: {
        type: TransactionType.INVOKE,
        hash: txHash,
        method,
        userId: user.id,
        contractId: contract.id,
      },
    });

    return transaction;
  }

  async getSummaryStats() {
    const [users, transactions, deploys, invokes] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.transaction.count(),
      this.prisma.transaction.count({ where: { type: "DEPLOY" } }),
      this.prisma.transaction.count({ where: { type: "INVOKE" } }),
    ]);

    return {
      users,
      transactions,
      deploys,
      invokes,
    };
  }

  async getRecentActivity() {
    const transactions = await this.prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        contract: true,
      },
    });

    return transactions.map((transaction) => ({
      id: transaction.id,
      wallet: transaction.user?.wallet,
      contract: transaction.contract?.address,
      action: transaction.type,
      hash: transaction.hash,
      timestamp: transaction.createdAt.toISOString(),
    }));
  }

  async getActivityOverTime() {
    const results = await this.prisma.$queryRaw<ActivityOverTimeType[]>`
    SELECT
      DATE(a."createdAt") AS date,
      COUNT(*) FILTER (WHERE a."type" = 'DEPLOY') AS deployments,
      COUNT(*) FILTER (WHERE a."type" = 'INVOKE') AS invocations,
      COUNT(*) FILTER (WHERE a."type" = 'COMPILE') AS compiles
    FROM (
      SELECT "createdAt", "type"::text AS "type"
      FROM "Transaction"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT "createdAt", "type"::text AS "type"
      FROM "Activity"
      WHERE "type" = 'COMPILE' AND "createdAt" >= NOW() - INTERVAL '30 days'
    ) AS a
    GROUP BY DATE(a."createdAt")
    ORDER BY DATE(a."createdAt") ASC;
  `;

    return results.map((r) => ({
      ...r,
      deployments: Number(r.deployments),
      invocations: Number(r.invocations),
      compiles: Number(r.compiles),
    }));
  }

  async getTransactionDistribution() {
    const results = await this.prisma.transaction.groupBy({
      by: ["type"],
      _count: {
        _all: true,
      },
    });

    const data = results.map((r) => ({
      name: r.type.charAt(0) + r.type.slice(1).toLowerCase(),
      value: r._count._all,
    }));

    return data;
  }

  async getUniqueUsersPerDay() {
    const raw = await this.prisma.$queryRaw<{ date: string; users: number }[]>`
      SELECT
        DATE("createdAt") AS date,
        COUNT(DISTINCT "wallet") AS users
      FROM "User"
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt");
    `;

    const filled = fillMissingTimeUnits(
      raw.map((r) => ({ ...r, users: Number(r.users) })),
      {
        unit: "day",
        range: 30,
        valueKeys: ["users"],
      },
    );

    return filled;
  }

  async getUniqueUsersPerWeek() {
    const raw = await this.prisma.$queryRaw<{ date: string; users: number }[]>`
      SELECT
        date_trunc('week', "createdAt") AS date,
        COUNT(DISTINCT "wallet") AS users
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '90 days'
      GROUP BY date_trunc('week', "createdAt")
      ORDER BY date_trunc('week', "createdAt");
    `;

    const filled = fillMissingTimeUnits(raw, {
      unit: "week",
      range: 8,
      valueKeys: ["users"],
    });

    return filled;
  }

  async getActiveUsersPerDay() {
    const raw = await this.prisma.$queryRaw<{ date: string; users: number }[]>`
      SELECT
        DATE(a."createdAt") AS date,
        COUNT(DISTINCT a."userId") AS users
      FROM (
        SELECT "userId", "createdAt"
        FROM "Activity"
        WHERE "type" = 'COMPILE'
        UNION ALL
        SELECT "userId", "createdAt"
        FROM "Transaction"
        WHERE "type" IN ('DEPLOY', 'INVOKE')
      ) AS a
      WHERE a."createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(a."createdAt")
      ORDER BY DATE(a."createdAt");
    `;

    const filled = fillMissingTimeUnits(raw, {
      unit: "day",
      range: 30,
      valueKeys: ["users"],
    });

    return filled;
  }

  async getActiveUsersPerWeek() {
    const raw = await this.prisma.$queryRaw<{ date: string; users: number }[]>`
    SELECT
      date_trunc('week', a."createdAt") AS date,
      COUNT(DISTINCT a."userId") AS users
    FROM (
      SELECT "userId", "createdAt"
      FROM "Activity"
      WHERE "type" = 'COMPILE'
      UNION ALL
      SELECT "userId", "createdAt"
      FROM "Transaction"
      WHERE "type" IN ('DEPLOY', 'INVOKE')
    ) AS a
    WHERE a."createdAt" >= NOW() - INTERVAL '90 days'
    GROUP BY date_trunc('week', a."createdAt")
    ORDER BY date_trunc('week', a."createdAt");
  `;

    const filled = fillMissingTimeUnits(raw, {
      unit: "week",
      range: 8,
      valueKeys: ["users"],
    });

    return filled;
  }

  /** Earliest recorded activity of any kind (start of the "all" range). */
  private async earliestActivity(): Promise<Date | null> {
    const [row] = await this.prisma.$queryRaw<{ earliest: Date | null }[]>`
      SELECT LEAST(
        (SELECT MIN("createdAt") FROM "Transaction"),
        (SELECT MIN("createdAt") FROM "Activity"),
        (SELECT MIN("createdAt") FROM "User")
      ) AS earliest;
    `;
    return row?.earliest ?? null;
  }

  async resolveRange(key: RangeKey): Promise<ResolvedRange> {
    return resolveRange(
      key,
      key === "all" ? await this.earliestActivity() : null,
    );
  }

  /** Distinct wallets with any compile/deploy/invoke per bucket. Buckets are whole days/ISO weeks/months. */
  async getActiveUsers(rangeKey: RangeKey, granularity: Granularity) {
    const range = await this.resolveRange(rangeKey);
    const from = truncateUtc(range.from, granularity);
    const rows = await this.prisma.$queryRaw<
      { bucket: Date; users: number }[]
    >(Prisma.sql`
      SELECT date_trunc(${granularity}, a."createdAt") AS bucket,
             COUNT(DISTINCT a."userId")::int AS users
      FROM (
        SELECT "userId", "createdAt" FROM "Activity"
        UNION ALL
        SELECT "userId", "createdAt" FROM "Transaction"
      ) AS a
      WHERE a."userId" IS NOT NULL AND a."createdAt" >= ${from} AND a."createdAt" < ${range.to}
      GROUP BY 1
      ORDER BY 1;
    `);
    return fillBuckets(rows, {
      from,
      to: range.to,
      granularity,
      keys: ["users"] as const,
    });
  }

  /** Deploys, invokes and compiles per bucket, gap-filled to a continuous series. */
  async getActivityTimeseries(rangeKey: RangeKey, granularity: Granularity) {
    const range = await this.resolveRange(rangeKey);
    const from = truncateUtc(range.from, granularity);
    const rows = await this.prisma.$queryRaw<
      {
        bucket: Date;
        deployments: number;
        invocations: number;
        compiles: number;
      }[]
    >(Prisma.sql`
      SELECT date_trunc(${granularity}, a."createdAt") AS bucket,
             COUNT(*) FILTER (WHERE a."type" = 'DEPLOY')::int AS deployments,
             COUNT(*) FILTER (WHERE a."type" = 'INVOKE')::int AS invocations,
             COUNT(*) FILTER (WHERE a."type" = 'COMPILE')::int AS compiles
      FROM (
        SELECT "createdAt", "type"::text AS "type" FROM "Transaction"
        UNION ALL
        SELECT "createdAt", "type"::text AS "type" FROM "Activity"
      ) AS a
      WHERE a."createdAt" >= ${from} AND a."createdAt" < ${range.to}
      GROUP BY 1
      ORDER BY 1;
    `);
    return fillBuckets(rows, {
      from,
      to: range.to,
      granularity,
      keys: ["deployments", "invocations", "compiles"] as const,
    });
  }

  /** Every compile/deploy/invoke in [from, to); the range filter sits in each branch so indexes apply. */
  private eventsSql(from: Date, to: Date) {
    return Prisma.sql`
      SELECT "userId", "contractId", "type"::text AS "type", "createdAt"
      FROM "Transaction"
      WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
      UNION ALL
      SELECT "userId", NULL::text AS "contractId", "type"::text AS "type", "createdAt"
      FROM "Activity"
      WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
    `;
  }

  private async periodTotals(from: Date, to: Date): Promise<PeriodTotals> {
    const [row] = await this.prisma.$queryRaw<PeriodTotals[]>(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE e."type" = 'DEPLOY')::int AS deploys,
             COUNT(*) FILTER (WHERE e."type" = 'INVOKE')::int AS invokes,
             COUNT(DISTINCT e."userId")::int AS users,
             COUNT(DISTINCT e."contractId")::int AS contracts,
             COUNT(DISTINCT e."contractId") FILTER (WHERE e."type" = 'INVOKE')::int AS "invokedContracts"
      FROM (${this.eventsSql(from, to)}) AS e;
    `);
    return row;
  }

  /** KPI values for the range, the previous period of equal length, and per-bucket sparklines. */
  async getOverview(rangeKey: RangeKey) {
    const range = await this.resolveRange(rangeKey);
    const granularity: Granularity = rangeKey === "all" ? "week" : "day";
    const sparkFrom = truncateUtc(range.from, granularity);

    const [current, previous, series] = await Promise.all([
      this.periodTotals(range.from, range.to),
      range.prevFrom && range.prevTo
        ? this.periodTotals(range.prevFrom, range.prevTo)
        : Promise.resolve(null),
      this.prisma.$queryRaw<({ bucket: Date } & PeriodTotals)[]>(Prisma.sql`
        SELECT date_trunc(${granularity}, e."createdAt") AS bucket,
               COUNT(*) FILTER (WHERE e."type" = 'DEPLOY')::int AS deploys,
               COUNT(*) FILTER (WHERE e."type" = 'INVOKE')::int AS invokes,
               COUNT(DISTINCT e."userId")::int AS users,
               COUNT(DISTINCT e."contractId")::int AS contracts,
               COUNT(DISTINCT e."contractId") FILTER (WHERE e."type" = 'INVOKE')::int AS "invokedContracts"
        FROM (${this.eventsSql(sparkFrom, range.to)}) AS e
        GROUP BY 1
        ORDER BY 1;
      `),
    ]);

    const buckets = fillBuckets(series, {
      from: sparkFrom,
      to: range.to,
      granularity,
      keys: [
        "deploys",
        "invokes",
        "users",
        "contracts",
        "invokedContracts",
      ] as const,
    });
    const spark = (pick: (b: (typeof buckets)[number]) => number) =>
      buckets.map(pick);

    return {
      range: {
        key: range.key,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        prevFrom: range.prevFrom?.toISOString() ?? null,
        prevTo: range.prevTo?.toISOString() ?? null,
        sparklineGranularity: granularity,
      },
      lastUpdated: new Date().toISOString(),
      kpis: {
        deploys: kpi(
          current.deploys,
          previous?.deploys ?? null,
          spark((b) => b.deploys),
        ),
        invokes: kpi(
          current.invokes,
          previous?.invokes ?? null,
          spark((b) => b.invokes),
        ),
        uniqueUsers: kpi(
          current.users,
          previous?.users ?? null,
          spark((b) => b.users),
        ),
        uniqueContracts: kpi(
          current.contracts,
          previous?.contracts ?? null,
          spark((b) => b.contracts),
        ),
        avgInvocationsPerContract: kpi(
          avgPerContract(current),
          previous ? avgPerContract(previous) : null,
          spark(avgPerContract),
        ),
      },
    };
  }

  async getTopContracts(rangeKey: RangeKey, limit: number) {
    const range = await this.resolveRange(rangeKey);
    return this.prisma.$queryRaw<
      {
        address: string;
        name: string | null;
        invocations: number;
        uniqueCallers: number;
        lastActivity: Date;
      }[]
    >(Prisma.sql`
      SELECT c."address", c."name",
             COUNT(*)::int AS invocations,
             COUNT(DISTINCT t."userId")::int AS "uniqueCallers",
             MAX(t."createdAt") AS "lastActivity"
      FROM "Transaction" t
      JOIN "Contract" c ON c."id" = t."contractId"
      WHERE t."type" = 'INVOKE' AND t."createdAt" >= ${range.from} AND t."createdAt" < ${range.to}
      GROUP BY c."id"
      ORDER BY invocations DESC, "lastActivity" DESC
      LIMIT ${limit};
    `);
  }

  async getTopWallets(rangeKey: RangeKey, limit: number) {
    const range = await this.resolveRange(rangeKey);
    return this.prisma.$queryRaw<
      {
        wallet: string;
        deploys: number;
        invokes: number;
        compiles: number;
        total: number;
        lastActivity: Date;
      }[]
    >(Prisma.sql`
      SELECT u."wallet",
             COUNT(*) FILTER (WHERE e."type" = 'DEPLOY')::int AS deploys,
             COUNT(*) FILTER (WHERE e."type" = 'INVOKE')::int AS invokes,
             COUNT(*) FILTER (WHERE e."type" = 'COMPILE')::int AS compiles,
             COUNT(*)::int AS total,
             MAX(e."createdAt") AS "lastActivity"
      FROM (${this.eventsSql(range.from, range.to)}) AS e
      JOIN "User" u ON u."id" = e."userId"
      GROUP BY u."id"
      ORDER BY total DESC, "lastActivity" DESC
      LIMIT ${limit};
    `);
  }

  /** Active wallets per bucket split into first-time (User created in that bucket) and returning. */
  async getNewVsReturning(rangeKey: RangeKey, granularity: Granularity) {
    const range = await this.resolveRange(rangeKey);
    const from = truncateUtc(range.from, granularity);
    const rows = await this.prisma.$queryRaw<
      { bucket: Date; newUsers: number; returningUsers: number }[]
    >(Prisma.sql`
      WITH active AS (
        SELECT DISTINCT date_trunc(${granularity}, e."createdAt") AS bucket, e."userId"
        FROM (${this.eventsSql(from, range.to)}) AS e
        WHERE e."userId" IS NOT NULL
      )
      SELECT a.bucket,
             COUNT(*) FILTER (WHERE date_trunc(${granularity}, u."createdAt") >= a.bucket)::int AS "newUsers",
             COUNT(*) FILTER (WHERE date_trunc(${granularity}, u."createdAt") < a.bucket)::int AS "returningUsers"
      FROM active a
      JOIN "User" u ON u."id" = a."userId"
      GROUP BY 1
      ORDER BY 1;
    `);
    return fillBuckets(rows, {
      from,
      to: range.to,
      granularity,
      keys: ["newUsers", "returningUsers"] as const,
    });
  }

  /** Events by ISO day of week (1 = Monday) and hour in the viewer's time zone; full 7x24 grid. */
  async getHeatmap(rangeKey: RangeKey, requestedZone: string) {
    const range = await this.resolveRange(rangeKey);
    const [{ valid }] = await this.prisma.$queryRaw<
      { valid: boolean }[]
    >(Prisma.sql`
      SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = ${requestedZone}) AS valid;
    `);
    const timezone = valid ? requestedZone : "UTC";

    const rows = await this.prisma.$queryRaw<
      { dow: number; hour: number; count: number }[]
    >(Prisma.sql`
      SELECT EXTRACT(ISODOW FROM (e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::int AS dow,
             EXTRACT(HOUR FROM (e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::int AS hour,
             COUNT(*)::int AS count
      FROM (${this.eventsSql(range.from, range.to)}) AS e
      GROUP BY 1, 2;
    `);

    const counts = new Map(rows.map((r) => [`${r.dow}:${r.hour}`, r.count]));
    const cells: { dow: number; hour: number; count: number }[] = [];
    for (let dow = 1; dow <= 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        cells.push({ dow, hour, count: counts.get(`${dow}:${hour}`) ?? 0 });
      }
    }
    return { timezone, cells };
  }

  private activityWhere(
    range: ResolvedRange,
    filters: ActivityFilters,
  ): Prisma.TransactionWhereInput {
    const { type, wallet, q } = filters;
    return {
      createdAt: { gte: range.from, lt: range.to },
      ...(type ? { type } : {}),
      ...(wallet ? { user: { wallet } } : {}),
      ...(q
        ? {
            OR: [
              { hash: { contains: q, mode: "insensitive" } },
              { user: { wallet: { contains: q, mode: "insensitive" } } },
              { contract: { address: { contains: q, mode: "insensitive" } } },
              { contract: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private activityOrder({
    sort,
    order,
  }: ActivityFilters): Prisma.TransactionOrderByWithRelationInput[] {
    const newestFirst: Prisma.TransactionOrderByWithRelationInput = {
      createdAt: "desc",
    };
    switch (sort) {
      case "action":
        return [{ type: order }, newestFirst];
      case "wallet":
        return [{ user: { wallet: order } }, newestFirst];
      case "contract":
        return [{ contract: { address: order } }, newestFirst];
      default:
        return [{ createdAt: order }, { id: order }];
    }
  }

  private toActivityRow(t: {
    id: string;
    type: TransactionType;
    hash: string | null;
    method: string | null;
    createdAt: Date;
    user: { wallet: string } | null;
    contract: { address: string; name: string | null } | null;
  }) {
    return {
      id: t.id,
      action: t.type,
      wallet: t.user?.wallet ?? null,
      contract: t.contract?.address ?? null,
      contractName: t.contract?.name ?? null,
      method: t.method,
      hash: t.hash,
      timestamp: t.createdAt.toISOString(),
    };
  }

  private readonly activitySelect = {
    id: true,
    type: true,
    hash: true,
    method: true,
    createdAt: true,
    user: { select: { wallet: true } },
    contract: { select: { address: true, name: true } },
  } satisfies Prisma.TransactionSelect;

  /** Server-side paginated, filtered, searchable and sortable transaction list. */
  async getActivityPage(
    rangeKey: RangeKey,
    filters: ActivityFilters,
    page: number,
    pageSize: number,
  ) {
    const range = await this.resolveRange(rangeKey);
    const where = this.activityWhere(range, filters);
    const [total, rows] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        orderBy: this.activityOrder(filters),
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.activitySelect,
      }),
    ]);
    return {
      rows: rows.map((r) => this.toActivityRow(r)),
      total,
      page,
      pageSize,
    };
  }

  /** Same filters as getActivityPage, as CSV (capped at EXPORT_LIMIT rows). */
  async exportActivityCsv(rangeKey: RangeKey, filters: ActivityFilters) {
    const range = await this.resolveRange(rangeKey);
    const rows = await this.prisma.transaction.findMany({
      where: this.activityWhere(range, filters),
      orderBy: this.activityOrder(filters),
      take: EXPORT_LIMIT,
      select: this.activitySelect,
    });
    return toCsv(
      [
        "timestamp",
        "action",
        "wallet",
        "contract",
        "contract_name",
        "method",
        "tx_hash",
      ],
      rows.map((r) => {
        const row = this.toActivityRow(r);
        return [
          row.timestamp,
          row.action,
          row.wallet,
          row.contract,
          row.contractName,
          row.method,
          row.hash,
        ];
      }),
    );
  }

  async recordCompile(wallet: string) {
    const user = await this.prisma.user.upsert({
      where: { wallet: wallet },
      update: {},
      create: { wallet: wallet },
    });

    return await this.prisma.activity.create({
      data: {
        type: "COMPILE",
        userId: user.id,
      },
    });
  }

  async getInfo() {
    return {
      users: await this.prisma.user.findMany(),
      contracts: await this.prisma.contract.findMany(),
      transactions: await this.prisma.transaction.findMany(),
    };
  }
}
