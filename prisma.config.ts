// Prisma Configuration for Chargily MCP Platform - MVP
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // SQLite for MVP (fastest to get started)
    url: process.env["DATABASE_URL"] || "file:./data/mvp.db",
  },
});
