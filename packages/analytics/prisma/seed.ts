/**
 * DEV-ONLY seed: fills a local database with ~18 months of synthetic Playground
 * activity so the analytics dashboard can be developed against realistic data.
 *
 *   yarn workspace analytics seed            # refuses to touch non-local DBs
 *   yarn workspace analytics seed --reset    # wipe analytics tables first
 *
 * Never run this against production.
 */
import { config } from "dotenv";
import { PrismaClient, TransactionType } from "@prisma/client";

config({ path: "../../.env" });

const url = process.env.DATABASE_URL ?? "";
if (
  process.env.NODE_ENV === "production" ||
  !/@(localhost|127\.0\.0\.1)[:/]/.test(url)
) {
  console.error(
    "Refusing to seed: DATABASE_URL must point at localhost and NODE_ENV must not be production.",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

// Deterministic PRNG so every developer gets the same dataset.
let state = 0x2f6e2b1;
function rand(): number {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return ((state >>> 0) % 1_000_000) / 1_000_000;
}
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)];

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const strkey = (prefix: "G" | "C") =>
  prefix +
  Array.from({ length: 55 }, () => BASE32[Math.floor(rand() * 32)]).join("");
const txHash = () =>
  Array.from(
    { length: 64 },
    () => "0123456789abcdef"[Math.floor(rand() * 16)],
  ).join("");

const CONTRACT_NAMES = [
  "main.sol",
  "token.sol",
  "math.sol",
  "storage_types.sol",
  "ttl_storage.sol",
  "error.sol",
  "print.sol",
];
const METHODS = [
  "inc",
  "get",
  "transfer",
  "mint",
  "balance",
  "max",
  "set",
  "approve",
];
const DAY_MS = 86_400_000;
const DAYS = 540;

/** Activity is busier on weekdays and during working hours (UTC). */
function randomTimeOnDay(day: Date): Date {
  const hour = Math.min(
    23,
    Math.max(0, Math.round(14 + (rand() + rand() + rand() - 1.5) * 9)),
  );
  const date = new Date(day);
  date.setUTCHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
  return date;
}

async function main() {
  if (process.argv.includes("--reset")) {
    await prisma.activity.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.contract.deleteMany();
    await prisma.user.deleteMany();
  }

  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      DAYS * DAY_MS,
  );

  const users: { id: string; wallet: string; createdAt: Date }[] = [];
  const contracts: {
    id: string;
    address: string;
    name: string;
    deployedById: string;
    createdAt: Date;
  }[] = [];
  const transactions: {
    type: TransactionType;
    hash: string;
    userId: string;
    contractId: string;
    method: string | null;
    createdAt: Date;
  }[] = [];
  const activities: { type: "COMPILE"; userId: string; createdAt: Date }[] = [];

  for (let d = 0; d <= DAYS; d++) {
    const day = new Date(start.getTime() + d * DAY_MS);
    const weekday = day.getUTCDay();
    const growth = 0.3 + (d / DAYS) * 1.4; // adoption grows over time
    const weekdayFactor = weekday === 0 || weekday === 6 ? 0.35 : 1;
    const quiet = rand() < 0.08; // occasional dead days, to exercise gap filling
    const sessions = quiet
      ? 0
      : Math.round(rand() * 6 * growth * weekdayFactor);

    for (let s = 0; s < sessions; s++) {
      // Returning users are likelier than new ones once a user base exists.
      const at = randomTimeOnDay(day);
      if (at.getTime() > now.getTime() - 3_600_000) continue; // no future timestamps
      const isNew = users.length < 5 || rand() < 0.35;
      const user = isNew
        ? (() => {
            const u = {
              id: crypto.randomUUID(),
              wallet: strkey("G"),
              createdAt: at,
            };
            users.push(u);
            return u;
          })()
        : (pick(users.filter((u) => u.createdAt <= at)) ?? users[0]);

      const compiles = 1 + Math.floor(rand() * 4);
      for (let c = 0; c < compiles; c++) {
        activities.push({
          type: "COMPILE",
          userId: user.id,
          createdAt: new Date(at.getTime() + c * 60_000),
        });
      }

      if (rand() < 0.7) {
        const deployedAt = new Date(at.getTime() + compiles * 60_000 + 30_000);
        const contract = {
          id: crypto.randomUUID(),
          address: strkey("C"),
          name: pick(CONTRACT_NAMES),
          deployedById: user.id,
          createdAt: deployedAt,
        };
        contracts.push(contract);
        transactions.push({
          type: TransactionType.DEPLOY,
          hash: txHash(),
          userId: user.id,
          contractId: contract.id,
          method: null,
          createdAt: deployedAt,
        });

        const invokes = Math.floor(rand() * 7);
        for (let i = 0; i < invokes; i++) {
          transactions.push({
            type: TransactionType.INVOKE,
            hash: txHash(),
            userId: user.id,
            contractId: contract.id,
            method: pick(METHODS),
            createdAt: new Date(deployedAt.getTime() + (i + 1) * 45_000),
          });
        }
      } else if (contracts.length > 0) {
        // Calls against someone else's (popular) contract.
        const popular =
          contracts[Math.floor(Math.pow(rand(), 3) * contracts.length)];
        transactions.push({
          type: TransactionType.INVOKE,
          hash: txHash(),
          userId: user.id,
          contractId: popular.id,
          method: pick(METHODS),
          createdAt: at,
        });
      }
    }
  }

  await prisma.user.createMany({ data: users });
  await prisma.contract.createMany({ data: contracts });
  await prisma.transaction.createMany({ data: transactions });
  await prisma.activity.createMany({ data: activities });

  console.log(
    `Seeded ${users.length} users, ${contracts.length} contracts, ${transactions.length} transactions, ${activities.length} compiles.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
