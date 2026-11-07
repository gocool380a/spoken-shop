"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Listing = {
  name: string;
  description: string;
  price: number;
  currency: string;
  quantity: number;
  language: string;
  priceNote?: string;
};

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
}

export default function SellerPage() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [listing, setListing] = useState<Listing | null>(null);
  const [shopUrl, setShopUrl] = useState("");
  const [copied, setCopied] = useState(false);
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

  async function copyLink() {
    await navigator.clipboard.writeText(shopUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const field = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900";

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 print:max-w-none print:py-0">
      {/* Everything in this block is hidden when printing the stall sign */}
      <div className="print:hidden">
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
          <section className="mt-8 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4" text-neutral-900>
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
            {listing.priceNote && <p className="text-sm text-amber-700">{listing.priceNote}</p>}
            <button onClick={publish} disabled={!!busy}
              className="w-full rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              Looks good — create my shop link
            </button>
          </section>
        )}
      </div>

      {shopUrl && listing && (
        <section className="mt-6 rounded-xl border border-green-300 bg-green-50 p-4 print:mt-0 print:border-0 print:bg-white print:p-0">
          <div className="print:hidden">
            <p className="font-semibold text-green-800">Your shop link is ready 🎉</p>
            <a href={shopUrl} target="_blank" className="mt-1 block break-all text-blue-700 underline">
              {shopUrl}
            </a>
            <div className="mt-3 flex gap-2">
              <button onClick={copyLink}
                className="rounded-lg border border-green-600 px-3 py-1 text-sm text-green-800">
                {copied ? "Copied ✓" : "Copy link"}
              </button>
              <button onClick={() => window.print()}
                className="rounded-lg bg-green-600 px-3 py-1 text-sm font-semibold text-white hover:bg-green-700">
                🖨️ Print stall sign
              </button>
            </div>
          </div>

          {/* The stall sign: shown on screen as a preview, and it's the only thing that prints */}
          <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 text-center print:mt-16 print:border-2 print:border-neutral-900">
            <p className="text-2xl font-bold print:text-5xl">{listing.name}</p>
            <p className="mt-1 text-xl text-neutral-700 print:mt-4 print:text-4xl">
              {formatPrice(listing.price, listing.currency)}
            </p>
            <div className="mt-4 flex justify-center print:mt-10">
              <QRCodeSVG value={shopUrl} size={220} level="M" marginSize={2} className="print:h-96 print:w-96" />
            </div>
            <p className="mt-4 text-lg font-semibold print:mt-10 print:text-3xl">
              📱 Scan to pay with PayPal
            </p>
          </div>
        </section>
      )}
    </main>
  );
}