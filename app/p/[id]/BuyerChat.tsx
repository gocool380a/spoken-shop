"use client";

// AI shop assistant for buyers: ask questions in any language, by text or voice,
// and buy right from the chat with a PayPal order created by the AI.
import { useEffect, useRef, useState } from "react";

type Checkout = { approveUrl: string; quantity: number; total: number; currency: string };
type Message = { role: "user" | "assistant"; content: string; checkout?: Checkout };

export default function BuyerChat({ productId, productName }: { productId: string; productName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError("");
    setInput("");
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages([...next, { role: "assistant", content: data.reply, checkout: data.checkout }]);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setBusy(true);
        try {
          const form = new FormData();
          form.append("audio", new Blob(chunks.current, { type: rec.mimeType }));
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setBusy(false);
          await send(data.text);
        } catch (err) {
          setBusy(false);
          setError(err instanceof Error && err.message ? err.message : "Couldn't hear that. Try again.");
        }
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setError("Couldn't use the microphone. You can type instead.");
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    setRecording(false);
  }

  const suggestions = ["Tell me more about it", "I'd like to buy 2"];

  return (
    <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="font-semibold">💬 Ask the shop</h2>
      <p className="text-sm text-neutral-500">
        Ask about {productName} in any language, or buy right here.
      </p>

      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-900"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.checkout && (
                <a
                  href={m.checkout.approveUrl}
                  className="mt-2 block rounded-lg bg-[#ffc439] px-3 py-2 text-center font-semibold text-neutral-900 hover:brightness-95"
                >
                  Pay {m.checkout.total.toFixed(2)} {m.checkout.currency} with PayPal
                  <span className="block text-xs font-normal">
                    {m.checkout.quantity} × {productName}
                  </span>
                </a>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-neutral-400">Typing…</p>}
        <div ref={bottom} />
      </div>

      {messages.length === 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-neutral-300 px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={busy && !recording}
          aria-label={recording ? "Stop recording" : "Speak your question"}
          className={`shrink-0 rounded-lg px-3 text-white disabled:opacity-40 ${
            recording ? "animate-pulse bg-red-600" : "bg-neutral-700"
          }`}
        >
          {recording ? "■" : "🎤"}
        </button>
        <input
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a question…"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-neutral-900 px-4 text-sm text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}
