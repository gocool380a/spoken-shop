// PayPal Agent Toolkit wrapper for the AI buyer chat.
// The AI decides WHAT to buy (quantity); this file fixes the price from the
// database, so a buyer can't talk the AI into a discount.
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/openai";
import type { Product } from "./store";

const g = globalThis as unknown as { paypalToolkit?: PayPalAgentToolkit; paypalToolkitAt?: number };

// The toolkit caches its PayPal access token, which expires after a few hours,
// so we start a fresh toolkit every hour.
const MAX_AGE_MS = 60 * 60 * 1000;

export function toolkit(): PayPalAgentToolkit {
  if (!g.paypalToolkit || Date.now() - (g.paypalToolkitAt ?? 0) > MAX_AGE_MS) {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("PayPal keys are not set.");
    g.paypalToolkit = new PayPalAgentToolkit({
      clientId,
      clientSecret,
      configuration: {
        actions: { orders: { create: true, get: true } },
        context: { sandbox: true },
      },
    });
    g.paypalToolkitAt = Date.now();
  }
  return g.paypalToolkit;
}

// Runs one PayPal toolkit tool and returns its JSON result.
async function runTool(name: string, args: Record<string, unknown>) {
  const result = await toolkit().handleToolCall({
    id: `call_${Date.now()}`,
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  });
  const content = typeof result.content === "string" ? result.content : JSON.stringify(result.content);
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(content);
  }
  // The toolkit reports PayPal failures as { error: { message } } instead of throwing.
  if (data?.error) throw new Error(`PayPal ${name} failed: ${data.error.message ?? JSON.stringify(data.error)}`);
  return data;
}

type PayPalLink = { rel: string; href: string };

export async function createAgentOrder(product: Product, quantity: number, origin: string) {
  const itemCost = Math.round(product.price * 100) / 100;
  const order = await runTool("create_order", {
    currencyCode: "USD",
    items: [
      {
        name: product.name,
        description: product.description.slice(0, 120),
        quantity,
        itemCost,
        itemTotal: Math.round(itemCost * quantity * 100) / 100,
      },
    ],
    returnUrl: `${origin}/p/${product.id}/paid`,
    cancelUrl: `${origin}/p/${product.id}`,
  });
  const links: PayPalLink[] = order.links ?? [];
  const approve = links.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!order.id || !approve) throw new Error("PayPal didn't return a payment link.");
  return { orderId: order.id as string, approveUrl: approve.href, total: itemCost * quantity };
}

export async function getAgentOrder(orderId: string) {
  return runTool("get_order", { id: orderId });
}

// Captures (completes) an approved order. Uses the toolkit's own PayPal client.
export async function captureAgentOrder(orderId: string) {
  const client = toolkit().client;
  const res = await fetch(`${client.getBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { ...(await client.getHeaders()), "Content-Type": "application/json" },
  });
  const data = await res.json();
  return { ok: res.ok && data.status === "COMPLETED", data };
}
