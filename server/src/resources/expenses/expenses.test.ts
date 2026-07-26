import { describe, it, expect } from "vitest";
import { app, getTestUser, getTestCategory, getAuthHeaders } from "../../test/setup";

// ── Tests ────────────────────────────────────────────────────────────

describe("Expenses API", () => {
  // ── GET /api/expenses (unauthenticated) ──────────────────────────
  describe("GET /api/expenses", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await app.request("/api/expenses");
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });
  });

  // ── POST /api/expenses ───────────────────────────────────────────
  describe("POST /api/expenses", () => {
    it("returns 401 when not authenticated", async () => {
      const category = getTestCategory();
      const res = await app.request("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          amount: 10,
          description: "Test expense",
          categoryId: category.id,
          date: new Date().toISOString(),
        }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 400 for missing required fields", async () => {
      const user = getTestUser();
      const res = await app.request("/api/expenses", {
        method: "POST",
        headers: getAuthHeaders(user.id),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for negative amount", async () => {
      const user = getTestUser();
      const category = getTestCategory();
      const res = await app.request("/api/expenses", {
        method: "POST",
        headers: getAuthHeaders(user.id),
        body: JSON.stringify({
          amount: -10,
          description: "Negative amount",
          categoryId: category.id,
          date: new Date().toISOString(),
        }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for empty description", async () => {
      const user = getTestUser();
      const category = getTestCategory();
      const res = await app.request("/api/expenses", {
        method: "POST",
        headers: getAuthHeaders(user.id),
        body: JSON.stringify({
          amount: 10,
          description: "",
          categoryId: category.id,
          date: new Date().toISOString(),
        }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 201 and creates expense with valid data", async () => {
      const user = getTestUser();
      const category = getTestCategory();
      const date = new Date().toISOString();
      const res = await app.request("/api/expenses", {
        method: "POST",
        headers: getAuthHeaders(user.id),
        body: JSON.stringify({
          amount: 42.5,
          description: "Lunch meeting",
          categoryId: category.id,
          date,
          scope: "personal",
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.amount).toBe("42.50");
      expect(body.data.description).toBe("Lunch meeting");
      expect(body.data.userId).toBe(user.id);
      expect(body.data.scope).toBe("personal");
    });
  });

  // ── GET /api/expenses (authenticated) ────────────────────────────
  describe("GET /api/expenses (list)", () => {
    it("returns paginated expense list", async () => {
      const user = getTestUser();
      const res = await app.request(
        "/api/expenses?page=1&pageSize=10",
        { headers: getAuthHeaders(user.id) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(typeof body.data.total).toBe("number");
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(10);
    });
  });

  // ── GET /api/expenses/:id ──────────────────────────────────────
  describe("GET /api/expenses/:id", () => {
    it("returns 404 for non-existent expense", async () => {
      const user = getTestUser();
      const res = await app.request(
        "/api/expenses/non-existent-id",
        { headers: getAuthHeaders(user.id) },
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });
});
