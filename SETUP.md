# Spoken Shop – first feature

Speak (or type) a product → AI makes a listing → you get a shop link → buyers pay with PayPal (sandbox).

## Run it on your laptop

1. Install **Node.js 20 or newer** (LTS) from nodejs.org.
2. Unzip this folder, open a terminal inside it, and run:
   ```bash
   npm install
   ```
3. Copy `.env.example` to a new file called `.env.local` and paste in your keys:
   - PayPal sandbox **Client ID** and **Secret**
   - **OpenAI API key**
4. Start it:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000

## Try the full flow

1. On the home page, tap **Tap to speak** and say something like
   *"Mango pickle, 5 dollars, 20 jars"* (any language works).
   Or type it in the box and press **Go**.
2. Check the listing, fix anything, then press **create my shop link**.
3. Open the shop link. Pay with PayPal using your **sandbox personal (buyer) account**
   from developer.paypal.com → Testing Tools → Sandbox Accounts.
   (Don't use your real PayPal login; it won't work in the sandbox.)
4. You should see "Payment complete", and the stock goes down by one.

## Put it on GitHub

```bash
git add .
git commit -m "First feature: voice to listing to PayPal checkout"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/spoken-shop.git
git push -u origin main
```
`.env.local` and the `data/` folder are ignored, so your keys and test products stay private.

## What's where

| File | What it does |
|---|---|
| `app/page.tsx` | Seller page: mic button, listing editor, shop link |
| `app/p/[id]/page.tsx` | Buyer shop page for one product |
| `app/p/[id]/BuyBox.tsx` | PayPal checkout buttons |
| `app/api/transcribe` | Audio → text (OpenAI Whisper) |
| `app/api/listing` | Text → product listing (OpenAI chat model) |
| `app/api/products` | Saves a product |
| `app/api/paypal/*` | Creates and captures PayPal orders (Orders API v2) |
| `lib/store.ts` | Saves products to `data/products.json` (swap for a database later) |

## If something goes wrong

- **Mic doesn't work:** the browser must be allowed to use the microphone; use the text box meanwhile.
- **"model not found" error:** change `OPENAI_MODEL` in `.env.local` to a model your account has.
- **PayPal error:** check you copied the **Sandbox** keys, not Live.
- Restart `npm run dev` after editing `.env.local`.
