"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function PaidClient() {
  const { id } = useParams<{ id: string }>();
  const orderId = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "done" | "error">(orderId ? "working" : "error");
  const [message, setMessage] = useState(orderId ? "" : "Missing PayPal order.");
  const started = useRef(false);

  useEffect(() => {
    if (!orderId || started.current) return;
    started.current = true;
    fetch("/api/chat/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, productId: id }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMessage(`You bought ${data.quantity}. The seller has been paid.`);
        setState("done");
      })
      .catch((err: unknown) => {
        setMessage(err instanceof Error && err.message ? err.message : "Something went wrong.");
        setState("error");
      });
  }, [orderId, id]);

  return (
    <div className="rounded-xl border border-neutral-200 p-6 text-center">
      {state === "working" && <p className="text-blue-700">Completing your payment…</p>}
      {state === "done" && (
        <>
          <p className="text-4xl">✅</p>
          <p className="mt-2 text-xl font-semibold text-green-700">Payment complete</p>
          <p className="mt-1 text-neutral-600">{message}</p>
        </>
      )}
      {state === "error" && <p className="text-red-600">{message}</p>}
      <a href={`/p/${id}`} className="mt-4 inline-block text-blue-700 underline">
        Back to the shop
      </a>
    </div>
  );
}
