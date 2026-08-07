import { getStore } from "@netlify/blobs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default async (req) => {
  const store = getStore("nutrition");

  try {
    if (req.method === "GET") {
      const { blobs } = await store.list();
      const items = await Promise.all(
        blobs.map(async (b) => {
          const raw = await store.get(b.key);
          return raw ? JSON.parse(raw) : null;
        })
      );
      return json(items.filter(Boolean));
    }

    if (req.method === "POST") {
      const body = await req.json();
      const id = body.id || crypto.randomUUID();
      const now = new Date().toISOString();
      const data = { ...body, id, createdAt: body.createdAt || now, updatedAt: now };
      await store.setJSON(id, data);
      return json(data, 201);
    }

    if (req.method === "PUT") {
      const body = await req.json();
      if (!body.id) return json({ error: "id manquant" }, 400);
      const existingRaw = await store.get(body.id);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const data = { ...existing, ...body, updatedAt: new Date().toISOString() };
      await store.setJSON(body.id, data);
      return json(data);
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id manquant" }, 400);
      await store.delete(id);
      return new Response(null, { status: 204 });
    }

    return json({ error: "Méthode non autorisée" }, 405);
  } catch (err) {
    return json({ error: err.message || "Erreur serveur" }, 500);
  }
};

export const config = { path: "/api/nutrition" };
