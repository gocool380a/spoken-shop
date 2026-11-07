import { Suspense } from "react";
import PaidClient from "./PaidClient";

// Where PayPal sends the buyer back after approving a chat checkout.
export default function PaidPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <Suspense fallback={<p className="text-neutral-500">Loading…</p>}>
        <PaidClient />
      </Suspense>
    </main>
  );
}
