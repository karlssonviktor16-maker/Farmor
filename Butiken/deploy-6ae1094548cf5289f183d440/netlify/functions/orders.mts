import type { Config, Context } from "@netlify/functions";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orders, products } from "../../db/schema.js";
import { requireAdmin } from "../../lib/auth.js";

const text = (value: unknown, max = 1000) => String(value ?? "").trim().slice(0, max);

async function createOrder(req: Request) {
  const body = await req.json();
  const productId = Number(body.productId);
  const quantity = Math.round(Number(body.quantity) || 1);
  const customerName = text(body.customerName, 200);
  const email = text(body.email, 200);
  const phone = text(body.phone, 50);
  const address = text(body.address);
  if (!customerName || !email.includes("@") || !phone || !address || quantity < 1) {
    return Response.json({ error: "Fyll i alla obligatoriska fält" }, { status: 400 });
  }

  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product || !product.visible || product.stock < 1) {
    return Response.json({ error: "Leksaken är tyvärr slutsåld" }, { status: 409 });
  }
  if (quantity > product.stock) {
    return Response.json({ error: `Det finns bara ${product.stock} kvar` }, { status: 409 });
  }

  const [order] = await db
    .insert(orders)
    .values({
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity,
      customerName,
      email,
      phone,
      address,
      message: text(body.message),
    })
    .returning();
  return Response.json({ id: order.id }, { status: 201 });
}

// Approving an order takes the toys out of stock. When nothing is left the toy disappears from the shop.
async function approve(orderId: number) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!order) return Response.json({ error: "Beställningen finns inte" }, { status: 404 });
    if (order.status === "godkand") return Response.json({ error: "Redan godkänd" }, { status: 409 });

    if (order.productId) {
      const [updated] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${order.quantity}` })
        .where(and(eq(products.id, order.productId), gte(products.stock, order.quantity)))
        .returning();
      if (!updated) {
        return Response.json({ error: "Det finns inte tillräckligt många kvar i lager" }, { status: 409 });
      }
    }
    const [saved] = await tx.update(orders).set({ status: "godkand" }).where(eq(orders.id, orderId)).returning();
    return Response.json(saved);
  });
}

export default async (req: Request, context: Context) => {
  const id = context.params.id ? Number(context.params.id) : null;

  if (req.method === "POST" && !id) return createOrder(req);

  const denied = await requireAdmin(req);
  if (denied) return denied;

  if (req.method === "GET") {
    return Response.json(await db.select().from(orders).orderBy(desc(orders.createdAt)));
  }

  if (req.method === "PATCH" && id) {
    const { status } = await req.json();
    if (status === "godkand") return approve(id);
    if (status !== "avbojd" && status !== "ny") return Response.json({ error: "Ogiltig status" }, { status: 400 });
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return Response.json({ error: "Beställningen finns inte" }, { status: 404 });
    if (order.status === "godkand") {
      return Response.json({ error: "En godkänd beställning kan inte ändras" }, { status: 409 });
    }
    const [saved] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return Response.json(saved);
  }

  if (req.method === "DELETE" && id) {
    await db.delete(orders).where(eq(orders.id, id));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/orders", "/api/orders/:id"],
};
