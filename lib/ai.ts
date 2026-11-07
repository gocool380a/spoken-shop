// AI helpers: speech-to-text (Whisper) and turning a sentence into a product listing.
const OPENAI = "https://api.openai.com/v1";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function key() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("OPENAI_API_KEY is missing in .env.local");
  return k;
}

export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "speech.webm");
  form.append("model", "whisper-1");
  // A hint of the kind of words sellers say helps Whisper with food names and money.
  form.append(
    "prompt",
    "A small seller describing what they sell, the price and how many they have. " +
      "For example: idly, dosa, vada, samosa, mango pickle, honey, jam, rupees, dollars, pesos, jars, pieces."
  );

  const res = await fetch(`${OPENAI}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed: ${await res.text()}`);
  return (await res.json()).text as string;
}

export type Listing = {
  name: string;
  description: string;
  price: number; // always USD, since PayPal checkout here is USD
  currency: string;
  quantity: number;
  language: string;
  spokenPrice?: number; // what the seller actually said, e.g. 3
  spokenCurrency?: string; // e.g. "INR"
  priceNote?: string; // shown to the seller, e.g. "You said ₹3 ≈ $0.04"
};

// Converts an amount to USD using today's rate. Returns undefined if it can't.
async function toUSD(amount: number, currency: string): Promise<number | undefined> {
  if (currency === "USD") return amount;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    const rate = Number(data?.rates?.[currency]); // units of `currency` per 1 USD
    if (!rate) return undefined;
    return Math.round((amount / rate) * 100) / 100;
  } catch {
    return undefined;
  }
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export async function textToListing(text: string): Promise<Listing> {
  const res = await fetch(`${OPENAI}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You turn a small seller's spoken sentence (any language) into a product listing.\n" +
            "Be faithful: translate what they said, never invent products, origins or claims.\n" +
            "Many sellers sell local foods and crafts. Keep local product names as they are " +
            "(for example idly, dosa, tamale, injera) and briefly explain them in the description.\n" +
            "If the product name is unclear, use the closest word the seller actually said.\n" +
            "Reply with JSON only:\n" +
            '{"name": string (short, English or the local name), ' +
            '"description": string (one simple, friendly English sentence based only on what was said), ' +
            '"price": number (the amount exactly as spoken), ' +
            '"currency": ISO 4217 code of the money the seller named (rupees = INR, pesos = MXN, naira = NGN, etc.; ' +
            "if no money word, guess from the language, e.g. Tamil or Hindi = INR; only use USD if truly unclear), " +
            '"quantity": integer (default 1 if not said), ' +
            '"language": the language the sentence is written or spoken in (English text with local food words is English)}.',
        },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Listing failed: ${await res.text()}`);
  const json = JSON.parse((await res.json()).choices[0].message.content);

  const spokenPrice = Math.max(0, Number(json.price) || 0);
  const spokenCurrency = String(json.currency || "USD").toUpperCase();

  const listing: Listing = {
    name: String(json.name || "Product"),
    description: String(json.description || ""),
    price: spokenPrice,
    currency: "USD",
    quantity: Math.max(1, parseInt(json.quantity) || 1),
    language: String(json.language || "English"),
  };

  if (spokenCurrency !== "USD") {
    const usd = await toUSD(spokenPrice, spokenCurrency);
    listing.spokenPrice = spokenPrice;
    listing.spokenCurrency = spokenCurrency;
    if (usd !== undefined) {
      listing.price = Math.max(0.01, usd);
      listing.priceNote = `You said ${money(spokenPrice, spokenCurrency)} ≈ ${money(listing.price, "USD")}. Buyers pay in USD through PayPal.`;
    } else {
      listing.priceNote = `You said ${money(spokenPrice, spokenCurrency)}, but I couldn't convert it. Please enter the price in USD.`;
    }
  }

  return listing;
}
