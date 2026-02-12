// Prisma Configuration for Chargily MCP Platform
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // PostgreSQL (default - recommended for production)
    url: process.env["DATABASE_URL"] || "postgresql://chargily:DANTEjoker@localhost:5432/chargily_mcp",

    // For MySQL, change DATABASE_URL in .env to:
    // DATABASE_URL="mysql://root:DANTEjoker@localhost:3306/chargily_mcp"
  },
});
