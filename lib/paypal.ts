// Minimal PayPal REST client for the sandbox (Orders API v2).
const BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal keys are missing in .env.local");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

export async function createOrder(opts: {
  amount: string; // "15.00"
  currency: string;
  description: string;
  referenceId: string;
}) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: opts.referenceId,
          description: opts.description.slice(0, 127),
          amount: { currency_code: opts.currency, value: opts.amount },
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Create order failed: ${JSON.stringify(data)}`);
  return data; // { id, status, ... }
}

export async function captureOrder(orderId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Capture failed: ${JSON.stringify(data)}`);
  return data; // { id, status: "COMPLETED", ... }
}
