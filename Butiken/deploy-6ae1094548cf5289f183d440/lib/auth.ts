import { getUser } from "@netlify/identity";

// Returns null if the request comes from a logged-in admin, otherwise an error response.
export async function requireAdmin(req: Request): Promise<Response | null> {
  const origin = req.headers.get("origin");
  if (req.method !== "GET" && origin && origin !== new URL(req.url).origin) {
    return Response.json({ error: "Otillåten begäran" }, { status: 403 });
  }
  const user = await getUser();
  if (!user) return Response.json({ error: "Du är inte inloggad" }, { status: 401 });
  if (!user.roles?.includes("admin")) {
    return Response.json({ error: "Kontot saknar rollen admin" }, { status: 403 });
  }
  return null;
}
