// Simple file-based product store.
// Good enough for the hackathon demo. Swap for a real database (e.g. Postgres on Render) later.
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number; // e.g. 5.00
  currency: string; // e.g. "USD"
  quantity: number; // stock left
  language: string; // language the seller spoke, e.g. "Hindi"
  originalText: string; // what the seller actually said
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "products.json");

async function readAll(): Promise<Product[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

async function writeAll(products: Product[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(products, null, 2));
}

export async function createProduct(
  input: Omit<Product, "id" | "createdAt">
): Promise<Product> {
  const products = await readAll();
  const product: Product = {
    ...input,
    id: crypto.randomBytes(4).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  products.push(product);
  await writeAll(products);
  return product;
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return (await readAll()).find((p) => p.id === id);
}

export async function reduceStock(id: string, by: number) {
  const products = await readAll();
  const p = products.find((x) => x.id === id);
  if (p) {
    p.quantity = Math.max(0, p.quantity - by);
    await writeAll(products);
  }
}
