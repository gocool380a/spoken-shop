import { transcribe } from "@/lib/ai";

// Receives recorded audio from the browser and returns the text.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob)) {
      return Response.json({ error: "No audio received" }, { status: 400 });
    }
    const text = await transcribe(audio);
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
