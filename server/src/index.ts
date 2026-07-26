import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { csrf } from "hono/csrf";
import { serve } from "@hono/node-server";

import { auth } from "./lib/auth";
import { authMiddleware } from "./lib/middleware";
import expenseRouter from "./resources/expenses/expense.router";
import groupRouter from "./resources/groups/group.router";
import membershipRouter from "./resources/memberships/membership.router";
import splitRouter from "./resources/splits/split.router";
import settlementRouter from "./resources/settlements/settlement.router";
import categoryRouter from "./resources/categories/category.router";
import budgetRouter from "./resources/budgets/budget.router";
import claimRouter from "./resources/claims/claim.router";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);

// BetterAuth handler — uses single wildcard for sub-path matching
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

// Public API routes (auth not required)
// (none currently — add here if needed)

// Protected API routes
const api = new Hono();
api.use("*", authMiddleware);

api.route("/expenses", expenseRouter);
api.route("/groups", groupRouter);
api.route("/memberships", membershipRouter);
api.route("/splits", splitRouter);
api.route("/settlements", settlementRouter);
api.route("/categories", categoryRouter);
api.route("/budgets", budgetRouter);
api.route("/claims", claimRouter);

app.route("/api", api);

export type AppType = typeof app;
export { app };

// Only start the HTTP server when this file is run directly (not imported in tests)
const isEntryPoint = process.argv[1]?.includes("index.ts") || process.argv[1]?.includes("index.js");
if (isEntryPoint) {
  const port = Number(process.env.PORT) || 3001;
  console.log(`Server running on http://localhost:${port}`);
  serve({ fetch: app.fetch, port });
}
