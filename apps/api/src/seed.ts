import bcrypt from "bcryptjs";
import { prisma } from "./db";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed demo data in production: it creates accounts with a well-known password. " +
        "Use \"pnpm --filter @coffee/api create-org\" to set up your real organization."
    );
  }
  const slug = "demo-factory";
  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    console.log(`Organization "${slug}" already exists, skipping seed.`);
    return;
  }

  const organization = await prisma.organization.create({
    data: {
      name: "Demo Coffee Factory",
      slug,
      smsSenderName: "DemoCoffee",
      staffUsers: {
        create: [
          {
            name: "Asha Admin",
            phone: "+254700000001",
            passwordHash: await bcrypt.hash("changeme123", 10),
            role: "ADMIN",
          },
          {
            name: "Kevin Clerk",
            phone: "+254700000002",
            passwordHash: await bcrypt.hash("changeme123", 10),
            role: "CLERK",
          },
        ],
      },
      farmers: {
        create: [
          { name: "James Mwangi", phone: "+254711111111" },
          { name: "Grace Wanjiru", phone: "+254722222222" },
        ],
      },
    },
  });

  console.log("Seeded organization:", organization.slug);
  console.log("Staff logins (phone / password):");
  console.log("  +254700000001 / changeme123 (ADMIN)");
  console.log("  +254700000002 / changeme123 (CLERK)");
  console.log("Farmer OTP login uses organizationSlug: demo-factory");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
