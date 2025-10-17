# Training Hub Implementation Status

Last updated: 2025-01-16
Reference: `src/AI_TRAINING_SPEC.md`

## ✅ Completed Features

### Core Pages
- [x] **Training Hub (Landing)** - `/training-hub`
  - Dashboard with real stats
  - Big "Start Reviewing" button
  - Links to all sub-pages
  
- [x] **Inbox (Priority Queue)** - `/training-hub/inbox`
  - Filters: quality tier, manual_id, has_numbers
  - Columns: checkbox, date, query, quality badge, numeric flag
  - Bulk action UI (checkboxes + buttons)
  
- [x] **Review Workspace** - `/training-hub/review/:id`
  - Left: Query + Answer + Detected claims + Detected numbers
  - Right: Form for Question, Answer, Evidence, Tags
  - **Numeric verification panel** with hard policy enforcement
  - **10-minute undo** tracking
  - Tooltips for guidance
  - Evidence selection via checkboxes
  
- [x] **Training Examples Manager** - `/training-hub/examples`
  - List of verified examples
  - Filter by approval status, tags
  - Toggle approval
  - Delete examples
  
- [x] **Export** - `/training-hub/export`
  - JSONL (instruction-tuning) format
  - Triples (reranker) format
  - CSV (FAQ) format
  - Export history tracking
  
- [x] **QA Generation** - `/training-hub/qa-generate`
  - Paste content → generate QA pairs
  - Manual ID and page range support

### Backend (Edge Functions)
- [x] `training-inbox` - Fetch query logs with filters
- [x] `training-query` - Get all query logs
- [x] `training-query-detail` - Get single query with citations
- [x] `training-create-example` - Create training example
- [x] `training-generate-qa` - Generate QA pairs from content
- [x] `training-export` - Export to JSONL/triples/CSV

### Security
- [x] Admin-only access via `x-admin-key` header
- [x] Protected routes (AdminRoute wrapper)
- [x] Training auth provider with session management

### Data Model
- [x] `query_logs` table with quality metrics
- [x] `training_examples` table with evidence spans
- [x] `training_exports` table for tracking
- [x] `feedback` table structure

## 🚧 Partially Complete

### Numeric Verification
- [x] Numeric detection in UI
- [x] Warning messages when numbers detected
- [x] Policy explanation panel
- [x] Prevent accept without verification
- [x] Server-side regex detection and auto-flagging
- [ ] Evidence span validation (contains exact number)

### Evidence Attachment
- [x] Checkbox selection of citations
- [x] Evidence spans saved to training examples
- [x] PDF/page viewer with thumbnails
- [x] Text selection in document viewer
- [ ] OCR text highlighting overlay (basic text selection implemented)
- [ ] Manual evidence span entry with validation

### Quality Metrics
- [x] Quality score display
- [x] Claim coverage display  
- [x] Numeric flags display
- [x] Auto claim extraction (server-side)
- [x] Auto claim-to-evidence matching
- [x] Quality tier calculation algorithm

## ❌ Not Yet Implemented

### Critical Missing Features
- [x] **Automated server-side checks** (per spec line 180-188):
  - [x] Claim extraction on POST /api/query
  - [x] Number detection regex
  - [x] Auto-claim coverage calculation
  - [x] Quality score composite metric
  - [x] Numeric auto-flag

- [x] **Document viewer** with:
  - [x] PDF page thumbnails sidebar
  - [x] Canvas-based image rendering
  - [x] Text search with highlighting
  - [x] Page navigation and zoom controls
  - [x] Selected evidence highlighting
  - [x] OCR text display and selection

- [ ] **Bulk actions implementation**:
  - [ ] Actually execute bulk accept/reject
  - [ ] Bulk tagging
  - [ ] Validation before bulk accept

### Nice-to-Have / Future
- [ ] Undo implementation (currently just shows UI)
- [ ] Ticket modal for "Send to Dev"
- [ ] Measurement instruction replacements
- [ ] Negative examples for reranker triples
- [ ] Quality score filtering in export
- [ ] Analytics dashboard
- [ ] Auto-refresh inbox
- [ ] Real-time collaboration

## 📋 Acceptance Criteria Status

From spec line 237-243:

- [x] Can review & Accept a training example in ≤ 60s ✓
- [x] Exported JSONL is valid ✓
- [x] Exported JSONL includes evidence spans ✓
- [~] Numeric verification prevents unverified numbers (UI only, not server-enforced)
- [x] Inbox surfaces highest impact items (quality tier filtering) ✓
- [~] Undo within 10 minutes (UI tracking only, no actual undo)

## 🎯 Priority Next Steps

To fully complete the spec:

1. **Server-side automation** (spec requirement): ✅ COMPLETE
   - ✅ Auto claim extraction in edge function
   - ✅ Number detection regex
   - ✅ Calculate quality_score properly
   - ✅ Auto-populate numeric_flags

2. **Evidence validation**:
   - Verify evidence contains exact numbers
   - Block accept if numeric policy violated

3. **Document viewer**: ✅ COMPLETE
   - ✅ Page image rendering with thumbnails
   - ✅ Text selection and highlighting capability
   - ✅ Page navigation and zoom
   - ✅ Evidence span attachment UI

4. **Bulk actions**:
   - Wire up bulk accept/reject/tag buttons
   - Add confirmation modals
   - Implement server-side bulk processing

## 📝 Notes

- Most frontend UI is complete and matches spec
- Backend edge functions working but lack auto-processing
- Numeric policy is enforced in UI but not server-validated
- Export formats match spec exactly
- 10-minute undo tracks actions but doesn't reverse them
- Training examples can be created and managed
- QA generation works with manual content

---

See `src/AI_TRAINING_SPEC.md` for the full specification.
