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
  price: number;
  currency: string;
  quantity: number;
  language: string;
};

export async function textToListing(text: string): Promise<Listing> {
  const res = await fetch(`${OPENAI}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You turn a small seller's spoken sentence (any language) into a product listing. " +
            "Reply with JSON only: {\"name\": string (English, short), \"description\": string " +
            "(English, one friendly sentence a buyer would like), \"price\": number, " +
            "\"currency\": ISO 4217 code (default USD if unclear), \"quantity\": integer " +
            "(default 1 if not said), \"language\": the language the seller used}.",
        },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Listing failed: ${await res.text()}`);
  const json = JSON.parse((await res.json()).choices[0].message.content);

  return {
    name: String(json.name || "Product"),
    description: String(json.description || ""),
    price: Math.max(0, Number(json.price) || 0),
    currency: String(json.currency || "USD").toUpperCase(),
    quantity: Math.max(1, parseInt(json.quantity) || 1),
    language: String(json.language || "English"),
  };
}
