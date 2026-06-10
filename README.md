# pdf-tools

Manipulate PDF files locally on your device with WebAssembly.

## Features

- Merge PDFs with optional AI instructions
- Split into individual pages
- Rotate all or specific pages
- Remove or extract specific pages
- Export pages as PNG images

## Getting started

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Environment variables

| Variable | Description |
|---|---|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key, required for AI instructions |
