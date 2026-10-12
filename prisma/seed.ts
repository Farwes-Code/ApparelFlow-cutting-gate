import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const USERS: { email: string; fullName: string; role: Role; password: string }[] = [
  { email: "supervisor@apparelflow.test", fullName: "Cutting Supervisor", role: "cutting_supervisor", password: "Cutting@123" },
  { email: "verifier@apparelflow.test", fullName: "Cutting Verifier", role: "cutting_verifier", password: "Verify@123" },
  { email: "sewing@apparelflow.test", fullName: "Sewing Supervisor", role: "sewing_supervisor", password: "Sewing@123" },
];

const RECIPES = [
  {
    recipeCode: "REC-BL01", name: "Casual Blouse", category: "Blouse", stdFabricYards: 1.8, wastageCap: 5.0,
    components: [
      ["Front Body Panel", 1], ["Back Body Panel", 1], ["Sleeves (Left & Right)", 2], ["Collar & Stand", 1], ["Sleeve Cuffs", 2],
    ] as [string, number][],
  },
  {
    recipeCode: "REC-CT02", name: "Crop Top", category: "Crop Top", stdFabricYards: 1.1, wastageCap: 8.0,
    components: [
      ["Front Chest Panel", 1], ["Back Support Panel", 1], ["Neck Binding Strip", 1], ["Hem Elastic Casing", 1], ["Side Strap Accents", 2],
    ] as [string, number][],
  },
];

async function main() {
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, fullName: u.fullName, role: u.role },
      create: { email: u.email, fullName: u.fullName, role: u.role, passwordHash },
    });
  }

  for (const r of RECIPES) {
    const existing = await prisma.recipe.findUnique({ where: { recipeCode: r.recipeCode } });
    if (existing) continue; // idempotent: safe to run many times
    await prisma.recipe.create({
      data: {
        recipeCode: r.recipeCode, name: r.name, category: r.category, stdFabricYards: r.stdFabricYards, wastageCap: r.wastageCap,
        components: { create: r.components.map(([componentName, piecesPerGarment]) => ({ componentName, piecesPerGarment })) },
      },
    });
  }
  console.log("Seed complete: 3 users, 2 recipes");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
