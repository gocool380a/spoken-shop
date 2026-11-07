"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    paypal?: any;
  }
}

// Loads PayPal's checkout buttons and wires them to our create/capture API routes.
export default function BuyBox(props: {
  productId: string;
  maxQty: number;
  currency: string;
  clientId: string;
}) {
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState("");
  const qtyRef = useRef(qty);
  const container = useRef<HTMLDivElement>(null);

  // Keep the latest quantity available to PayPal's callbacks.
  useEffect(() => {
    qtyRef.current = qty;
  }, [qty]);

  useEffect(() => {
    if (!props.clientId) return;
    const src = `https://www.paypal.com/sdk/js?client-id=${props.clientId}&currency=${props.currency}`;

    function render() {
      if (!container.current || !window.paypal) return;
      container.current.innerHTML = "";
      window.paypal
        .Buttons({
          createOrder: async () => {
            const res = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId: props.productId, quantity: qtyRef.current }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            return data.id;
          },
          onApprove: async (data: { orderID: string }) => {
            setStatus("Confirming payment…");
            const res = await fetch("/api/paypal/capture-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderID }),
            });
            const result = await res.json();
            setStatus(
              result.status === "COMPLETED"
                ? "✅ Payment complete! The seller has been notified."
                : `Payment not completed: ${result.error || result.status}`
            );
          },
          onError: (err: Error) => setStatus(`Something went wrong: ${err.message}`),
        })
        .render(container.current);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing && window.paypal) {
      render();
    } else {
      const s = document.createElement("script");
      s.src = src;
      s.onload = render;
      document.body.appendChild(s);
    }
  }, [props.clientId, props.currency, props.productId]);

  return (
    <div className="mt-6">
      <label className="text-sm text-neutral-600">
        Quantity{" "}
        <input
          type="number"
          min={1}
          max={props.maxQty}
          value={qty}
          onChange={(e) => setQty(Math.min(props.maxQty, Math.max(1, Number(e.target.value))))}
          className="ml-2 w-20 rounded-lg border border-neutral-300 px-2 py-1"
        />
      </label>
      {!props.clientId && (
        <p className="mt-4 text-red-600">PayPal client ID is missing on the server.</p>
      )}
      <div ref={container} className="mt-4" />
      {status && <p className="mt-4 font-medium">{status}</p>}
    </div>
  );
}
