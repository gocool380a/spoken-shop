import { textToListing } from "@/lib/ai";

// Turns "mango pickle, 5 dollars, 20 jars" into a structured listing.
export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return Response.json({ error: "Say or type something first" }, { status: 400 });
    }
    const listing = await textToListing(text);
    return Response.json({ listing });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
