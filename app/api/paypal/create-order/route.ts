import { createOrder } from "@/lib/paypal";
import { getProduct } from "@/lib/store";

// Creates a PayPal order. The price always comes from our store, never from the browser.
export async function POST(req: Request) {
  try {
    const { productId, quantity } = await req.json();
    const product = await getProduct(productId);
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });

    const qty = Math.max(1, parseInt(quantity) || 1);
    if (qty > product.quantity) {
      return Response.json({ error: "Not enough stock" }, { status: 400 });
    }

    const order = await createOrder({
      amount: (product.price * qty).toFixed(2),
      currency: product.currency,
      description: `${qty} x ${product.name}`,
      referenceId: `${product.id}:${qty}`,
    });
    return Response.json({ id: order.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
