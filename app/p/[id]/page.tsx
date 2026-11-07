import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/store";
import BuyBox from "./BuyBox";
import BuyerChat from "./BuyerChat";

// The buyer-facing shop page for one product.
export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <p className="text-sm text-neutral-500">Spoken Shop</p>
      <Suspense fallback={<p className="mt-4 text-neutral-500">Loading…</p>}>
        <ProductDetails params={params} />
      </Suspense>
    </main>
  );
}

async function ProductDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const price = new Intl.NumberFormat("en", { style: "currency", currency: product.currency })
    .format(product.price);

  return (
    <>
      <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
      <p className="mt-2 text-neutral-700">{product.description}</p>
      <p className="mt-4 text-2xl font-semibold">{price}</p>
      <p className="text-sm text-neutral-500">
        {product.quantity > 0 ? `${product.quantity} in stock` : "Sold out"}
      </p>

      {product.quantity > 0 && (
        <BuyBox
          productId={product.id}
          maxQty={product.quantity}
          currency={product.currency}
          clientId={process.env.PAYPAL_CLIENT_ID || ""}
        />
      )}

      <BuyerChat productId={product.id} productName={product.name} />
    </>
  );
}