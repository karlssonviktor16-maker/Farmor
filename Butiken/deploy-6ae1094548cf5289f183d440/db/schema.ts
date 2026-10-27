import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: serial().primaryKey(),
  name: text().notNull(),
  description: text().notNull().default(""),
  price: integer().notNull(),
  stock: integer().notNull().default(1),
  imageKey: text("image_key"),
  visible: boolean().notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial().primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer().notNull().default(1),
  customerName: text("customer_name").notNull(),
  email: text().notNull(),
  phone: text().notNull(),
  address: text().notNull(),
  message: text().notNull().default(""),
  // "ny" | "godkand" | "avbojd"
  status: text().notNull().default("ny"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
