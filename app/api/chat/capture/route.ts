// Completes a PayPal order that the AI buyer chat created, after the buyer approved it.
import { NextRequest, NextResponse } from "next/server";
import { getProduct, reduceStock } from "@/lib/store";
import { captureAgentOrder, getAgentOrder } from "@/lib/paypalAgent";

type OrderItem = { name: string; quantity: string };

export async function POST(req: NextRequest) {
  try {
    const { orderId, productId } = await req.json();
    if (typeof orderId !== "string" || !/^[A-Z0-9]{10,40}$/.test(orderId)) {
      return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    }
    const product = await getProduct(String(productId ?? ""));
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const order = await getAgentOrder(orderId);
    const item: OrderItem | undefined = order?.purchase_units?.[0]?.items?.[0];
    if (!item || item.name !== product.name) {
      return NextResponse.json({ error: "This order doesn't match the product." }, { status: 400 });
    }
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));

    // Page refreshed after paying: already done, don't reduce stock twice.
    if (order.status === "COMPLETED") {
      return NextResponse.json({ ok: true, quantity, alreadyCaptured: true });
    }
    if (order.status !== "APPROVED") {
      return NextResponse.json({ error: "The payment wasn't approved yet." }, { status: 400 });
    }

    const capture = await captureAgentOrder(orderId);
    if (!capture.ok) {
      console.error("capture failed:", JSON.stringify(capture.data));
      return NextResponse.json({ error: "PayPal couldn't complete the payment." }, { status: 502 });
    }

    await reduceStock(product.id, quantity);
    return NextResponse.json({ ok: true, quantity });
  } catch (err) {
    console.error("chat capture error:", err);
    return NextResponse.json({ error: "Something went wrong completing the payment." }, { status: 500 });
  }
}
