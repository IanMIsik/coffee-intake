import crypto from "node:crypto";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { createOrganizationSchema } from "@coffee/shared";
import { prisma } from "../db";

const USAGE = `Usage:
  pnpm --filter @coffee/api create-org -- \
    --name "Richard Misik Estate" --slug richard-misik-estate --sender RMEstate \
    --admin-name "Your Name" --admin-phone 0712345678 [--password <min 8 chars>]

Creates the organization and its first admin. If --password is omitted a strong one
is generated and printed once; write it down, it can't be shown again.`;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const generatePassword = (n = 14) =>
  Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      slug: { type: "string" },
      sender: { type: "string" },
      "admin-name": { type: "string" },
      "admin-phone": { type: "string" },
      password: { type: "string" },
    },
  });

  const generated = !values.password;
  const password = values.password ?? generatePassword();
  const parsed = createOrganizationSchema.safeParse({
    name: values.name,
    slug: values.slug,
    smsSenderName: values.sender ?? (values.name ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 11),
    adminName: values["admin-name"],
    adminPhone: values["admin-phone"],
    adminPassword: password,
  });
  if (!parsed.success) {
    console.error(parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n"));
    console.error(`\n${USAGE}`);
    process.exitCode = 1;
    return;
  }

  const d = parsed.data;
  if (await prisma.organization.findUnique({ where: { slug: d.slug } })) {
    console.error(`An organization with the code "${d.slug}" already exists.`);
    process.exitCode = 1;
    return;
  }

  await prisma.organization.create({
    data: {
      name: d.name,
      slug: d.slug,
      smsSenderName: d.smsSenderName,
      staffUsers: {
        create: {
          name: d.adminName,
          phone: d.adminPhone,
          passwordHash: await bcrypt.hash(d.adminPassword, 10),
          role: "ADMIN",
        },
      },
    },
  });

  console.log(`\nCreated "${d.name}" (organization code: ${d.slug})`);
  console.log(`Admin sign-in phone: ${d.adminPhone}`);
  console.log(generated ? `Admin password (shown once): ${password}` : "Admin password: the one you supplied");
  console.log("\nUse the organization code in the mobile app's Server setting and the web app's VITE_ORGANIZATION_SLUG.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
