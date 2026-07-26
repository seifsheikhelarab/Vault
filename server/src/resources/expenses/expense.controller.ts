import { ExpenseService } from "./expense.service";
import { ok, fail } from "../../lib/response";

const service = new ExpenseService();

// Context parameter typed as 'any' because Hono v4's generic context types
// (with zValidator middleware) create complex intersection types that are
// impractical to propagate through a controller class. Runtime safety is
// maintained by the zValidator middleware in the router.

export class ExpenseController {
  async create(c: any) {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const expense = await service.create(userId, body);
    return c.json(ok(expense), 201);
  }

  async list(c: any) {
    const userId = c.get("userId") as string;
    const query = c.req.valid("query");
    const result = await service.list(userId, query);
    return c.json(ok(result));
  }

  async getById(c: any) {
    const userId = c.get("userId") as string;
    const id = c.req.param("id")!;
    const expense = await service.getById(userId, id);
    if (!expense) return c.json(fail("NOT_FOUND", "Expense not found"), 404);
    return c.json(ok(expense));
  }

  async update(c: any) {
    const userId = c.get("userId") as string;
    const id = c.req.param("id")!;
    const body = c.req.valid("json");
    const expense = await service.update(userId, id, body);
    if (!expense) return c.json(fail("NOT_FOUND", "Expense not found"), 404);
    return c.json(ok(expense));
  }

  async delete(c: any) {
    const userId = c.get("userId") as string;
    const id = c.req.param("id")!;
    const expense = await service.delete(userId, id);
    if (!expense) return c.json(fail("NOT_FOUND", "Expense not found"), 404);
    return c.json(ok({ deleted: true }));
  }
}
