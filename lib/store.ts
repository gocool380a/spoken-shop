// Product store backed by Postgres (Neon).
// Reads DATABASE_URL from .env.local locally, and from Render's Environment in production.
import { Pool } from "pg";
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

// Reuse one connection pool, even when Next.js reloads code during development.
const g = globalThis as unknown as { pgPool?: Pool; dbReady?: Promise<void> };

function pool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local (and to Render's Environment).");
  }
  if (!g.pgPool) {
    g.pgPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return g.pgPool;
}

// Creates the products table the first time the app runs.
function ready(): Promise<void> {
  let p = g.dbReady;
  if (!p) {
    p = pool()
      .query(`
        CREATE TABLE IF NOT EXISTS products (
          id            TEXT PRIMARY KEY,
          name          TEXT NOT NULL,
          description   TEXT NOT NULL DEFAULT '',
          price         NUMERIC(10,2) NOT NULL,
          currency      TEXT NOT NULL DEFAULT 'USD',
          quantity      INTEGER NOT NULL DEFAULT 0,
          language      TEXT NOT NULL DEFAULT '',
          original_text TEXT NOT NULL DEFAULT '',
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)
      .then(
        () => undefined,
        (err: unknown) => {
          g.dbReady = undefined; // try again on the next request
          throw err;
        }
      );
    g.dbReady = p;
  }
  return p;
}

type Row = {
  id: string;
  name: string;
  description: string;
  price: string; // Postgres returns NUMERIC as a string
  currency: string;
  quantity: number;
  language: string;
  original_text: string;
  created_at: Date;
};

function toProduct(r: Row): Product {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    price: Number(r.price),
    currency: r.currency,
    quantity: r.quantity,
    language: r.language,
    originalText: r.original_text,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function createProduct(
  input: Omit<Product, "id" | "createdAt">
): Promise<Product> {
  await ready();
  const { rows } = await pool().query<Row>(
    `INSERT INTO products (id, name, description, price, currency, quantity, language, original_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      crypto.randomBytes(4).toString("hex"),
      input.name,
      input.description ?? "",
      input.price,
      input.currency || "USD",
      Math.max(0, Math.round(Number(input.quantity) || 0)),
      input.language ?? "",
      input.originalText ?? "",
    ]
  );
  return toProduct(rows[0]);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  await ready();
  const { rows } = await pool().query<Row>(`SELECT * FROM products WHERE id = $1`, [id]);
  return rows[0] ? toProduct(rows[0]) : undefined;
}

export async function reduceStock(id: string, by: number) {
  await ready();
  // One atomic update, so two buyers at once can't both grab the last item.
  await pool().query(
    `UPDATE products SET quantity = GREATEST(0, quantity - $2) WHERE id = $1`,
    [id, by]
  );
}