"use client";

import { useRef, useState } from "react";

type Listing = {
  name: string;
  description: string;
  price: number;
  currency: string;
  quantity: number;
  language: string;
};

export default function SellerPage() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [shopUrl, setShopUrl] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await handleAudio(new Blob(chunks.current, { type: rec.mimeType }));
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError("Couldn't use the microphone. Allow mic access, or type below.");
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    setRecording(false);
  }

  async function handleAudio(audio: Blob) {
    setBusy("Listening…");
    const form = new FormData();
    form.append("audio", audio);
    const res = await fetch("/api/transcribe", { method: "POST", body: form });
    const data = await res.json();
    setBusy("");
    if (!res.ok) return setError(data.error);
    setText(data.text);
    await makeListing(data.text);
  }

  async function makeListing(input = text) {
    setError("");
    setShopUrl("");
    setBusy("Creating your listing…");
    const res = await fetch("/api/listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) return setError(data.error);
    setListing(data.listing);
  }

  async function publish() {
    if (!listing) return;
    setBusy("Publishing…");
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...listing, originalText: text }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) return setError(data.error);
    setShopUrl(`${window.location.origin}/p/${data.product.id}`);
  }

  const field = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900";

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold">Spoken Shop</h1>
      <p className="mt-1 text-neutral-600">
        Say what you sell, the price and how many you have. In any language.
      </p>

      <button
        onClick={recording ? stopRecording : startRecording}
        disabled={!!busy}
        className={`mx-auto mt-8 flex h-36 w-36 items-center justify-center rounded-full text-lg font-semibold text-white shadow-lg transition ${
          recording ? "animate-pulse bg-red-600" : "bg-blue-600 hover:bg-blue-700"
        } disabled:opacity-50`}
      >
        {recording ? "Tap to stop" : "🎤 Tap to speak"}
      </button>

      <p className="mt-6 text-sm text-neutral-500">Or type it (handy for testing):</p>
      <div className="mt-1 flex gap-2">
        <input
          className={field}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="mango pickle, 5 dollars, 20 jars"
        />
        <button
          onClick={() => makeListing()}
          disabled={!!busy || !text.trim()}
          className="rounded-lg bg-neutral-900 px-4 text-white disabled:opacity-40"
        >
          Go
        </button>
      </div>

      {busy && <p className="mt-4 text-blue-700">{busy}</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}

      {listing && (
        <section className="mt-8 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="font-semibold">Check your listing</h2>
          <input className={field} value={listing.name}
            onChange={(e) => setListing({ ...listing, name: e.target.value })} />
          <textarea className={field} rows={2} value={listing.description}
            onChange={(e) => setListing({ ...listing, description: e.target.value })} />
          <div className="flex gap-2">
            <input className={field} type="number" step="0.01" value={listing.price}
              onChange={(e) => setListing({ ...listing, price: Number(e.target.value) })} />
            <input className={`${field} w-24`} value={listing.currency}
              onChange={(e) => setListing({ ...listing, currency: e.target.value })} />
            <input className={`${field} w-24`} type="number" value={listing.quantity}
              onChange={(e) => setListing({ ...listing, quantity: Number(e.target.value) })} />
          </div>
          <p className="text-xs text-neutral-500">
            Price · Currency · Stock — spoken in {listing.language}
          </p>
          <button onClick={publish} disabled={!!busy}
            className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50">
            Looks good — create my shop link
          </button>
        </section>
      )}

      {shopUrl && (
        <section className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4">
          <p className="font-semibold text-green-800">Your shop link is ready 🎉</p>
          <a href={shopUrl} target="_blank" className="mt-1 block break-all text-blue-700 underline">
            {shopUrl}
          </a>
          <button onClick={() => navigator.clipboard.writeText(shopUrl)}
            className="mt-3 rounded-lg border border-green-600 px-3 py-1 text-sm text-green-800">
            Copy link
          </button>
        </section>
      )}
    </main>
  );
}
