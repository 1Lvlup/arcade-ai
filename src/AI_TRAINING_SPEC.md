# AI Training Hub — SPEC (single source of truth)

Last updated: 2025-01-16  
Owner: Admin  
Purpose: A compact, admin-only Training Hub that makes it obvious what to do to create high-quality training data for the troubleshooting assistant. This file is the authoritative spec for UI, backend, data model, workflows, safety rules, and acceptance criteria.

---

## High-level goals
1. **Admin-only**: Single admin account (me) with an `ADMIN_API_KEY`. No public access.
2. **Speed + safety**: Review → attach evidence → accept. Numeric values cannot be accepted unless verified.
3. **Low friction**: I should be able to accept a training example in ≤ 60 seconds.
4. **Produces trainable artifacts**: Every accepted example becomes a row in `training_examples` and is exportable as JSONL/triples.
5. **Auditability**: Keep full logs and an undo within 10 minutes.

---

## Where to put it
- Path: `src/AI_TRAINING_SPEC.md` (this file)
- Deploy instructions: add the file to the project root, commit to repo. The assistant/upstream tool will fetch it when prompted to "read spec".

---

## Admin access & secrets
- Required environment variables:
  - `OPENAI_API_KEY` or equivalent
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_API_KEY` (strong secret)
  - `STORAGE_BUCKET` for photos (S3 or Supabase storage)
- Admin access patterns:
  - All Admin endpoints require header `x-admin-key: <ADMIN_API_KEY>`.
  - UI must be behind simple auth (basic password, protected route), but server enforces `x-admin-key`.

---

## UX & screens (exact copy text / flow)
### Dashboard (Landing)
- Title: **Training Hub — Admin Console**
- Subtitle: *One place to review model mistakes, verify fixes, and produce high-quality training data.*
- Big button: **Start Reviewing (Inbox)**

### Inbox (priority queue)
- Filters: `Low confidence | High frequency | Numeric flagged | All`
- Columns: checkbox, date, doc_id, query_text, response_snippet, quality_score badge, numeric_flag
- Bulk actions: `Accept as training | Reject | Assign Tag`

### Review Workspace (single-item)
- Left: Query + Model Answer + "Detected claims" + "Detected numbers"
- Center: Document viewer (PDF thumbnails & OCR text) with highlight → **Attach evidence**
- Right: Editor fields: Question, Answer, Evidence spans list, Tags, Numeric verification panel
- Buttons:
  - **Accept & Create Training Example** (green)
  - **Edit & Accept**
  - **Reject** (choose reason)
  - **Send to Dev** (ticket modal)
- Guidance tooltips (must appear inline):
  - "Attach at least one evidence span per factual claim."
  - "If numbers are present, attach evidence that contains the number or replace with measurement instructions."

### Auto-generate QA (bulk)
- Paste excerpt or select doc + pages → **Generate QA Candidates** → list with quick accept/edit/reject.
- Bulk accept: **Accept All Selected → Tag**

### Training Examples manager & Export
- List of verified examples
- Export options: JSONL (instruction-tuning), Triples (reranker), CSV (FAQ)
- Export metadata stored in `training_exports`.

---

## Exact DB schema (copy-paste)
```sql
create table query_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user text,
  doc_id text,
  query_text text,
  normalized_query text,
  messages jsonb,
  model_name text,
  response_text text,
  top_doc_ids text[],
  top_doc_scores float[],
  citations jsonb,
  quality_score float,
  claim_coverage float,
  numeric_flags jsonb,
  photo_url text,
  created_at timestamptz default now()
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  query_id uuid references query_logs(id),
  feedback_type text,
  reason text,
  details text,
  photo_url text,
  time_to_fix_minutes int,
  created_by text,
  created_at timestamptz default now()
);

create table training_examples (
  id uuid primary key default gen_random_uuid(),
  source_query_id uuid references query_logs(id),
  doc_id text,
  question text,
  answer text,
  evidence_spans jsonb,
  tags text[],
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz default now()
);

create table training_exports (
  id uuid primary key default gen_random_uuid(),
  name text,
  example_count int,
  filters jsonb,
  file_url text,
  created_by text,
  created_at timestamptz default now()
);
```

---

## API contract (admin-only, `x-admin-key` required)

* `POST /api/query`
  Payload: `{ admin_user, doc_id, messages, model_name, response_text, top_doc_ids, top_doc_scores, citations, quality_score, claim_coverage, numeric_flags }`
  Returns: `{ query_id }`

* `GET /api/inbox?filter=low_quality|numeric|freq`
  Returns list of query logs with minimal fields.

* `GET /api/query/:id`
  Returns full query_logs row + parsed claims + detected numbers.

* `POST /api/training_examples`
  Payload: `{ source_query_id, doc_id, question, answer, evidence_spans, tags, verified_by }`
  Returns: created training_examples row.

* `POST /api/feedback`
  Payload: `{ query_id, feedback_type, reason, details, photo_url, time_to_fix_minutes, created_by }`

* `POST /api/generate_qa`
  Payload: `{ manual_excerpt, doc_id, meta }`
  Returns: `[{question, answer, sources}, ...]`

* `POST /api/export`
  Payload: `{ format: 'jsonl'|'triples'|'csv', filters }`
  Returns: download link, stores metadata.

* `POST /api/verify_number`
  Payload: `{ query_id, number, evidence_span }`
  Action: attach verification record.

---

## System prompts & QA generation prompts (exact text)

**System prompt (for verification & admin use):**

```
SYSTEM: You are a conservative, precise arcade technician assistant and content generator. Do NOT invent numeric measurements. If a measurement is required and not present in the excerpt, instruct the admin how to measure rather than providing a number. Return outputs that are concise and include citation placeholders like [doc:pgX].
```

**QA generation prompt:**

```
You are an experienced arcade technician. Given this manual excerpt, produce 6 realistic technician questions. For each, return: question, answer (1-4 steps), sources (citation placeholders like [doc:pgX]). Return JSON array only.
```

---

## Automated server-side checks (must run on every `POST /api/query`)

1. **Claim extraction** — split answer into sentences/claims; store in `query_logs.claims`.
2. **Number detection** — regex detect numeric tokens and units; populate `numeric_flags`.
3. **Auto-claim coverage** — test each claim vs top-3 chunks using lexical match or semantic similarity; compute `claim_coverage`.
4. **Quality score** — composite metric weighted toward `claim_coverage`. Store `quality_score`.
5. **Numeric auto-flag** — if numbers present and not found in top-3, set `numeric_flag`.

Do NOT auto-accept or create training_examples. All acceptances must be explicit admin actions.

---

## Numeric policy (hard rule)

* **No unverified numbers accepted.** When admin attempts to Accept:

  * If `numeric_flags` non-empty, require either:

    * an attached evidence span that contains the exact number, OR
    * a replacement answer that instructs how to measure and collects the measurement later.
  * The Accept button must be disabled unless numeric verification is satisfied or replaced.

---

## Evidence span format

```json
{
  "doc": "GameX",
  "page": 12,
  "start_char": 512,
  "end_char": 610,
  "text": "exact excerpt text"
}
```

Evidence spans must be attached to the verified `training_examples`.

---

## Export formats (exact)

**Instruction-tuning JSONL**
One JSONL per line:

```
{"prompt":"Q: <<QUESTION>>\nContext: [doc_id:<<doc_id>>]\nA:","completion":" <<ANSWER>>\nSource: <<EVIDENCE_SPANS>>"}
```

**Reranker triples**

```
{"query":"<<QUESTION>>","positive":"<<CHUNK_ID_POS>>","negative":"<<CHUNK_ID_NEG>>"}
```

---

## Acceptance criteria (how I know the Hub works)

* I can review & Accept a training example in ≤ 60s.
* Exported JSONL is valid and includes evidence spans.
* Numeric verification prevents any unverified numbers from being accepted.
* Inbox surfaces highest impact items (low confidence, numeric flagged, high frequency).
* Undo within 10 minutes works.

---

## Quick admin workflows (copy-paste to UI tooltips)

1. **Review single item**

   * Open Inbox → click item.
   * Read Query + Answer → inspect Detected claims/numbers.
   * Highlight evidence in doc viewer → Attach.
   * Verify numbers (or replace with measurement step).
   * Edit answer to short steps (2–6).
   * Click *Accept & Create Training Example*.

2. **Bulk QA generation**

   * Paste excerpt → Generate QA → Accept candidates → Export.

3. **Export**

   * Go to Training Examples → Filter → Export → Choose JSONL → Download.

---

## Testing & rollout

* Local dev test: seed 10 generated QA items, review, accept, export JSONL, load into training runner.
* Canaries: internal-only for 7 days; measure grounding_rate & numeric_hallucination_rate.
* Go-live: only after `verified_examples_count >= 100` and grounding_rate >= 0.8 on seeded holdouts.

---

## Minimal checklist for shipping

* [ ] Add `src/AI_TRAINING_SPEC.md` to repo (this file).
* [ ] Implement DB tables (query_logs, feedback, training_examples, training_exports).
* [ ] Implement server endpoints with `x-admin-key` enforcement.
* [ ] Implement numeric verification logic and UI enforcement.
* [ ] Implement evidence span attach in doc viewer.
* [ ] Implement export to JSONL/triples.
* [ ] Run a test seed: 100 auto-generated QA → review 100 → export successful JSONL.
* [ ] Demo walkthrough recorded (10 min).

---

## Notes for future readers / devs

* This file is the ground truth. If anything in chat conflicts with this file, follow this file and update it with a timestamp.
* If the admin asks "check the spec", the assistant should re-load this file and prioritize its instructions.
* Any deviation from this spec must be recorded in `training_exports` metadata.

---

End of spec
