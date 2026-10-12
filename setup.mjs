// Run once from the project root:  node setup.mjs
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.scripts = { ...pkg.scripts, postinstall: "prisma generate", test: "vitest run", seed: "tsx prisma/seed.ts" };
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log("package.json scripts updated (postinstall, test, seed)");

fs.rmSync("prisma.config.ts", { force: true });
fs.rmSync("src/generated", { recursive: true, force: true });

const schemaPath = "prisma/schema.prisma";
if (fs.existsSync(schemaPath)) {
  const s = fs.readFileSync(schemaPath, "utf8");
  const fixed = s.replace(/^\s*output\s*=.*\r?\n/m, "");
  if (fixed !== s) {
    fs.writeFileSync(schemaPath, fixed);
    console.log("Removed custom generator output from schema.prisma");
  }
}
console.log("Setup done. Next: npx prisma generate && npx prisma db push && npm run seed && npm test");
