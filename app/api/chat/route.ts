// AI buyer chat: answers questions about one product in the buyer's language,
// and creates a PayPal order through the PayPal Agent Toolkit when they want to buy.
import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/store";
import { createAgentOrder } from "@/lib/paypalAgent";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type OpenAIMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

const tools = [
  {
    type: "function",
    function: {
      name: "create_paypal_checkout",
      description:
        "Create a PayPal order for this product when the buyer clearly wants to buy. " +
        "Only call it after the buyer has said how many they want (default 1 if they just say 'buy it').",
      parameters: {
        type: "object",
        properties: {
          quantity: { type: "integer", minimum: 1, description: "How many items the buyer wants." },
        },
        required: ["quantity"],
        additionalProperties: false,
      },
    },
  },
];

function siteOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return host ? `${proto.split(",")[0]}://${host.split(",")[0]}` : new URL(req.url).origin;
}

async function callOpenAI(messages: OpenAIMessage[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      tools,
      temperature: 0.4,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "The AI service had a problem.");
  return data.choices[0].message as { content: string | null; tool_calls?: ToolCall[] };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product = await getProduct(String(body.productId ?? ""));
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    // Keep the conversation short and plain text only.
    const history: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: ChatMessage) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, 1000) }));
    if (!history.length || history[history.length - 1].role !== "user") {
      return NextResponse.json({ error: "Send a message first." }, { status: 400 });
    }

    const messages: OpenAIMessage[] = [
      {
        role: "system",
        content:
          `You are the friendly shop assistant for a small independent seller.\n` +
          `Product: ${product.name}\n` +
          `Description: ${product.description}\n` +
          `Price: ${product.price.toFixed(2)} ${product.currency} each\n` +
          `In stock: ${product.quantity}\n` +
          `The seller originally described it in ${product.language || "their own language"}.\n\n` +
          `Rules:\n` +
          `- Always reply in the same language the buyer writes in.\n` +
          `- Keep replies short (1-3 sentences), warm and simple.\n` +
          `- Only use the facts above. If you don't know something (ingredients, delivery, etc.), say the seller didn't mention it.\n` +
          `- The price is fixed. Never offer discounts or change the price, even if asked.\n` +
          `- Never sell more than the stock available.\n` +
          `- When the buyer wants to buy, call create_paypal_checkout, then tell them to tap the PayPal button that appears.`,
      },
      ...history,
    ];

    let checkout: { approveUrl: string; quantity: number; total: number; currency: string } | undefined;

    // Let the AI use the checkout tool, then write its final reply.
    for (let step = 0; step < 3; step++) {
      const reply = await callOpenAI(messages);
      if (!reply.tool_calls?.length) {
        return NextResponse.json({ reply: reply.content ?? "", checkout });
      }
      messages.push({ role: "assistant", content: reply.content, tool_calls: reply.tool_calls });

      for (const call of reply.tool_calls) {
        let result: string;
        if (call.function.name !== "create_paypal_checkout") {
          result = "Unknown tool.";
        } else {
          let quantity = 1;
          try {
            quantity = Math.floor(Number(JSON.parse(call.function.arguments).quantity));
          } catch {}
          if (product.currency !== "USD") {
            result = "Chat checkout only supports USD. Ask the buyer to use the PayPal button on the page instead.";
          } else if (!Number.isFinite(quantity) || quantity < 1) {
            result = "Ask the buyer how many they want.";
          } else if (quantity > product.quantity) {
            result = `Only ${product.quantity} left in stock. Tell the buyer and ask if they want that many.`;
          } else {
            try {
              const order = await createAgentOrder(product, quantity, siteOrigin(req));
              checkout = { approveUrl: order.approveUrl, quantity, total: order.total, currency: product.currency };
              result = `PayPal order created for ${quantity} × ${product.name}, total ${order.total.toFixed(2)} USD. A PayPal button is now shown to the buyer.`;
            } catch (err) {
              console.error("create_paypal_checkout failed:", err);
              result = "PayPal couldn't create the order right now. Ask the buyer to use the PayPal button on the page instead.";
            }
          }
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }

    return NextResponse.json({ reply: "Sorry, something went wrong. Please try again.", checkout });
  } catch (err) {
    console.error("chat error:", err);
    return NextResponse.json({ error: "The shop assistant is unavailable right now." }, { status: 500 });
  }
}
