import type { Config, Context } from "@netlify/functions";
import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../../db/index.js";
import { products } from "../../db/schema.js";
import { requireAdmin } from "../../lib/auth.js";

type ProductInput = {
  name?: unknown;
  description?: unknown;
  price?: unknown;
  stock?: unknown;
  imageKey?: unknown;
  visible?: unknown;
  sortOrder?: unknown;
};

function parseInput(body: ProductInput) {
  const name = String(body.name ?? "").trim();
  const price = Math.round(Number(body.price));
  const stock = Math.round(Number(body.stock));
  if (!name) return { error: "Namn saknas" };
  if (!Number.isFinite(price) || price < 0) return { error: "Ogiltigt pris" };
  if (!Number.isFinite(stock) || stock < 0) return { error: "Ogiltigt antal i lager" };
  return {
    values: {
      name,
      description: String(body.description ?? "").trim(),
      price,
      stock,
      imageKey: body.imageKey ? String(body.imageKey) : null,
      visible: body.visible !== false,
      sortOrder: Math.round(Number(body.sortOrder)) || 0,
    },
  };
}

const forSale = and(eq(products.visible, true), gt(products.stock, 0));

export default async (req: Request, context: Context) => {
  const id = context.params.id ? Number(context.params.id) : null;
  const wantsAll = new URL(req.url).searchParams.has("alla");

  if (req.method === "GET") {
    if (wantsAll) {
      const denied = await requireAdmin(req);
      if (denied) return denied;
      return Response.json(await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id)));
    }
    if (id) {
      const [product] = await db.select().from(products).where(and(eq(products.id, id), eq(products.visible, true)));
      if (!product) return Response.json({ error: "Leksaken finns inte" }, { status: 404 });
      return Response.json(product);
    }
    return Response.json(await db.select().from(products).where(forSale).orderBy(asc(products.sortOrder), asc(products.id)));
  }

  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (req.method === "POST" && !id) {
    const parsed = parseInput(await req.json());
    if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });
    const [created] = await db.insert(products).values(parsed.values!).returning();
    return Response.json(created, { status: 201 });
  }

  if (req.method === "PUT" && id) {
    const parsed = parseInput(await req.json());
    if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });
    const [updated] = await db.update(products).set(parsed.values!).where(eq(products.id, id)).returning();
    if (!updated) return Response.json({ error: "Leksaken finns inte" }, { status: 404 });
    return Response.json(updated);
  }

  if (req.method === "DELETE" && id) {
    await db.delete(products).where(eq(products.id, id));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/products", "/api/products/:id"],
};
