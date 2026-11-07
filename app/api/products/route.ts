import { createProduct } from "@/lib/store";

// Saves a confirmed listing and returns its shop page id.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const price = Number(body.price);
    if (!body.name || !(price > 0)) {
      return Response.json({ error: "Name and a price above 0 are required" }, { status: 400 });
    }
    const product = await createProduct({
      name: String(body.name),
      description: String(body.description || ""),
      price: Math.round(price * 100) / 100,
      currency: String(body.currency || "USD").toUpperCase(),
      quantity: Math.max(1, parseInt(body.quantity) || 1),
      language: String(body.language || "English"),
      originalText: String(body.originalText || ""),
    });
    return Response.json({ product });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
