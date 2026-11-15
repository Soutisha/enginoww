# Task 13 — Generative AI Marketing Engine

## Delivered

Task 13 is implemented as a company-scoped marketing workspace using the AI provider already configured in **Settings → AI**.

### Content generation modes

1. **AI product descriptions** — uses saved catalogue fields from the selected product, or explicitly supplied product facts. Generated copy can be applied to the product description only after the user chooses to do so.
2. **WhatsApp reply generation** — drafts a reply from pasted conversation context. It does not send a WhatsApp message.
3. **Promotional copy** — generates multiple variants from a confirmed offer, audience and objective. It is instructed not to invent discounts, stock scarcity or claims.
4. **Campaign generation** — creates a campaign concept, objective, audience and channel-specific message variants. The UI can convert the result into a DRAFT campaign using the existing Campaigns API; it does not launch it.
5. **Social media content** — generates platform-aware captions and optional hashtags for Instagram, Facebook, LinkedIn, X, website or WhatsApp Status.
6. **Banner generation** — generates headline, subheadline, CTA, visual direction and alt text, then renders a downloadable 1200×630 SVG banner using the saved brand palette. This is an editable vector layout, not an AI-generated photographic image.

### Brand consistency

The Marketing Studio has a company-scoped brand profile with brand name, tagline, voice, target audience, value propositions, preferred terms, avoid terms, CTA style, locale and two brand colours. The profile is included in the generation prompt. The backend then checks generated title, summary, variants, CTA, hashtags and banner text for avoid terms and validates the colour palette.

The check is deterministic and limited to the configured rules; it is not a guarantee of legal, trademark or factual compliance. Users must review output before publishing.

### Persistence and API

All generation output is saved as a `MarketingAsset` with `DRAFT` status and records its input, type, channel/platform, AI provider/model and creator. Brand settings are persisted in `MarketingBrandProfile`. Both are scoped by `companyId`.

- `GET /api/marketing/brand-profile`
- `PUT /api/marketing/brand-profile`
- `POST /api/marketing/generate`
- `GET /api/marketing/assets`
- `GET /api/marketing/assets/:id`
- `DELETE /api/marketing/assets/:id`

The endpoints use the existing JWT, company-scope and `products` permission guards. AI calls use the encrypted company AI configuration; supported provider paths include Anthropic Messages and the configured OpenAI-compatible endpoints. Missing AI configuration returns a service-unavailable response instead of fake content.

## Database migration and run steps

From the repository root:

```bash
pnpm install
pnpm --filter @wacrm/database db:generate
pnpm db:migrate
pnpm --filter @wacrm/api type-check
pnpm --filter @wacrm/dashboard type-check
pnpm --filter @wacrm/api test -- --runInBand
pnpm --filter @wacrm/dashboard build
```

For production, deploy the migration using the database package's `db:migrate:deploy` script with `DATABASE_URL` configured.

Open `/marketing` after logging in. Configure and test an AI provider in Settings → AI first. Set up the Brand voice & rules profile, then generate a draft.

## Important boundaries

- Nothing is auto-sent to WhatsApp, email or SMS.
- Nothing is auto-published to social media or the storefront.
- Campaign creation from the Marketing Studio creates a DRAFT only; review its audience and content in Campaigns before scheduling or launching.
- Banner output is a locally rendered SVG design based on generated text and the brand palette. No image-generation API or image hosting is connected.
- Product claims are constrained by supplied product facts, but human review remains required.
- Provider availability, model access, rate limits and usage costs depend on the company's AI provider account.
