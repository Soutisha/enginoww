# Task 11 — RAG Business Brain

## Implemented
- Authenticated, company-scoped business document upload and listing.
- Text extraction for PDF, DOCX, TXT, Markdown, CSV, JSON, HTML and XML.
- 15 MB upload cap; scanned PDFs are rejected with an OCR guidance message.
- Existing Markdown chunker and configured OpenAI/Gemini embedder reused.
- Existing pgvector + PostgreSQL full-text hybrid search reused.
- Source-grounded answers through the configured AI provider, with `[S1]` citation markers and a source panel.
- `COMPANY`, `PRIVATE`, and `RESTRICTED` visibility metadata. A centralized access-policy helper is shared by document listing and retrieval: company members can read `COMPANY`; owners/admins can read `PRIVATE`; owners, explicitly shared users, and admins can read `RESTRICTED`. Tenant scoping remains enforced in database queries.
- Business Brain dashboard page at `/knowledge`.

## Apply database changes
From the repository root:

```bash
pnpm install
pnpm --filter @wacrm/database db:generate
pnpm --filter @wacrm/database db:migrate:deploy
```

If the `MemoryChunk` vector/FTS setup has not yet been applied, run the repository's existing SQL setup once:

```bash
psql "$DATABASE_URL" -f packages/database/prisma/migrations/manual_pgvector.sql
```

Then deploy the Prisma migration above. Ensure the PostgreSQL `vector` extension is available.

## Run and verify

```bash
pnpm dev:api
pnpm dev:dashboard
pnpm verify:task11
pnpm --filter @wacrm/api test -- --runInBand
```

Configure an embedding-capable provider (OpenAI or Gemini) in Settings → AI for semantic vectors. If embeddings are not configured, retrieval continues in keyword-only mode using PostgreSQL full-text search. Configure the chat provider as usual for answer generation.

## API
- `GET /api/memory/business-documents`
- `POST /api/memory/business-documents/upload`
- `DELETE /api/memory/business-documents/:id`
- `POST /api/memory/business-documents/search`
- `POST /api/ai/chat/knowledge`

Upload JSON fields: `fileName`, `mimeType`, `dataBase64`, optional `visibility`, optional `allowedUserIds`.

## Notes / limitations
- PDF text extraction supports text-based PDFs; it does not perform OCR on scanned/image-only pages.
- PDF extraction uses a lightweight built-in parser; unusual font encodings, encrypted PDFs, and complex layout PDFs may need a dedicated PDF parser/OCR service.
- The answer prompt instructs the configured model to cite `[S#]` sources and the UI always shows retrieved source excerpts; as with any LLM, verify high-impact answers against the source documents.
- `RESTRICTED` uploads accept user IDs through the API. The UI currently exposes company-visible and private-to-uploader modes; restricted sharing can be performed through the API until a user-picker is added.
- Search candidates are ranked by the existing hybrid retriever, then filtered through the centralized document ACL policy before any excerpt is returned to the user. Unit tests cover the ACL matrix, chunk line ranges, and query tokenization/FTS query construction.
