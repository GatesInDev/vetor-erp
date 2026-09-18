import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { encrypt } from "../src/lib/crypto";
import { defaultAccounts } from "../src/lib/account-catalog";

async function main() {
  const name = process.env.INITIAL_COMPANY_NAME;
  const taxId = process.env.INITIAL_COMPANY_TAX_ID;
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!name || !taxId || !email || !password || password.length < 16) throw new Error("Initial company and admin environment variables are required; password must contain at least 16 characters");
  const db = new PrismaClient();
  try {
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw new Error("Initial admin already exists");
    await db.$transaction(async (transaction) => {
      const company = await transaction.company.create({ data: { name, taxIdEncrypted: encrypt(taxId) } });
      await transaction.user.create({ data: { companyId: company.id, email: email.toLowerCase(), passwordHash: await argon2.hash(password), role: "ADMIN" } });
      await transaction.account.createMany({ data: defaultAccounts.map((account) => ({ ...account, companyId: company.id })) });
      await transaction.monthlyTask.createMany({ data: [
        { companyId: company.id, month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), title: "Export bank statements and reconciliation" },
        { companyId: company.id, month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), title: "Export service invoices and receipts" },
        { companyId: company.id, month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), title: "Send payroll and contractor documents to accountant" },
      ] });
    });
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
