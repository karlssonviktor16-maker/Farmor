import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { requireAdmin } from "../../lib/auth.js";

const store = () => getStore("product-images");

export default async (req: Request, context: Context) => {
  if (req.method === "GET" && context.params.key) {
    const result = await store().getWithMetadata(context.params.key, { type: "arrayBuffer" });
    if (!result) return new Response("Not found", { status: 404 });
    return new Response(result.data, {
      headers: {
        "Content-Type": String(result.metadata.contentType ?? "image/jpeg"),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (req.method === "POST") {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return Response.json({ error: "Välj en bildfil" }, { status: 400 });
    }
    const key = `${Date.now()}-${crypto.randomUUID()}`;
    await store().set(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });
    return Response.json({ key }, { status: 201 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/images", "/api/images/:key"],
};
