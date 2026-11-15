# Task 12 — Computer Vision Product Intelligence

## Implemented
- Authenticated `POST /products/vision/analyze` endpoint, scoped to the signed-in user's company and `products` permission.
- JPEG, PNG, WEBP and GIF validation with a 10 MB upload limit.
- Uses the company's configured AI key server-side; credentials are never returned to the client.
- OpenAI and Gemini vision-capable model support through their OpenAI-compatible chat completions endpoints.
- Structured extraction of product name, category, description, attributes, tags, visible text (OCR-style extraction), condition, image quality, confidence and warnings.
- Output normalization and bounds before returning it to the dashboard.
- Product Intelligence UI at `/products/vision`, linked from the Products page.
- Results can be copied for manual catalogue entry. The workflow does not create or modify a product automatically.

## Configuration
Configure an OpenAI vision model (for example `gpt-4o` / `gpt-4.1`) or a Gemini model in Settings → AI. The configured model must support image input. Other providers are intentionally rejected until their image request formats and model capabilities are explicitly integrated.

## API
`POST /products/vision/analyze`
- Authentication: JWT
- Permission: `products`
- Content-Type: `multipart/form-data`
- Field: `image`
- Maximum size: 10 MB
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

## Verification
Run from the repository root:
```bash
pnpm verify:task12
pnpm --filter @wacrm/api test -- --runInBand
pnpm --filter @wacrm/api type-check
pnpm --filter @wacrm/dashboard type-check
```

## Limitations / acceptance notes
- OCR and product recognition are model-assisted and must be reviewed by a human; confidence is a model estimate, not a calibrated probability.
- No dedicated OCR engine or background removal is included.
- Similar-product matching is not implemented because no product-image embedding/index exists in the current schema.
- Analysis is synchronous and subject to provider latency/timeouts.
- Runtime integration tests require a configured AI provider, API key, database and running API.
