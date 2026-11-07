import { captureOrder } from "@/lib/paypal";
import { reduceStock } from "@/lib/store";

// Captures the payment after the buyer approves it, then updates stock.
export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();
    const result = await captureOrder(orderId);

    if (result.status === "COMPLETED") {
      const ref: string = result.purchase_units?.[0]?.reference_id || "";
      const [productId, qty] = ref.split(":");
      if (productId) await reduceStock(productId, parseInt(qty) || 1);
    }
    return Response.json({ status: result.status, id: result.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
