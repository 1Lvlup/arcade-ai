# Complete Manual Upload Workflow Explained

## Current Issues with Jurassic Park 2

### Why 87% Complete?
- **Total figures detected**: 459 images from LlamaCloud
- **Filtered to keep**: ~370 actual diagrams (removed headers/footers/decorations)
- **OCR Status**:
  - ✅ 177 successfully processed (48%)
  - ⏳ 182 still pending (49%)
  - ❌ 10 failed (3%)
  - 🔄 1 processing

**The 87% is misleading** - it's actually **text processing complete** but image OCR is only ~48% done.

### Why 193+ Images Instead of ~35 Pages?

**LlamaCloud extracts EVERYTHING from the PDF**, including:
- Every diagram/schematic
- Every table 
- Every text box
- **Headers on every page** (e.g., "Operator's Manual")
- **Footers on every page** (e.g., "Page 4")
- **Section headers** (e.g., "Safety", "Product Specifications")
- Small decorative elements

**Example from Page 2:**
- Manual has ~35 pages
- Page 2 alone has **22 separate image elements**:
  - Headers: "Operator's Manual"
  - Section titles: "Product Specifications", "DC Power Fuse Guide"
  - Tables: Voltage specs, fuse ratings
  - Text boxes: Specifications, warnings
  - Footers: Copyright notices

## Complete Upload Workflow (Step-by-Step)

### Step 1: Upload PDF
**Location**: ManualUpload.tsx  
**What Happens**:
1. User selects PDF file
2. File uploads to Supabase `manuals` bucket
3. Creates entry in `documents` table
4. Triggers LlamaCloud parsing job

**Result**: Job ID returned, manual enters "waiting" state

---

### Step 2: LlamaCloud Processing (External)
**Service**: LlamaCloud API  
**What Happens**:
1. PDF is parsed into markdown text
2. **Every visual element** is extracted as an image
3. Metadata about each element (position, size, type) is captured
4. When done, webhook calls our system

**Result**: Markdown + 200-500+ images per manual

---

### Step 3: Webhook Receives Data
**Location**: supabase/functions/llama-webhook/index.ts  
**What Happens**:

#### 3A. Text Processing (Lines 90-550)
1. **Hierarchical chunking** - breaks markdown into semantic chunks
2. **Page extraction** - identifies page numbers
3. **Menu path tracking** - maintains document structure
4. **Embedding generation** - creates vector embeddings via OpenAI
5. **Database insertion** - stores in `chunks_text` and `rag_chunks`

**Progress**: 0% → 76%

#### 3B. Image Filtering (Lines 27-60, 664-689)
**Filters OUT**:
- Headers/footers (pageHeader, pageFooter, sectionHeader)
- Page numbers
- Backgrounds, borders, decorations
- Text blocks labeled as "text"
- Small images (<150x100px or <20k pixels²)
- Weird aspect ratios (>8:1 or <1:8)

**Filters IN** (kept as valuable):
- Diagrams
- Schematics  
- Tables (as images)
- Photos
- Charts
- Key visual region

**Example**: 459 raw images → 370 filtered images

**Progress**: 76% → 80%

#### 3C. Image Download & Storage (Lines 722-850)
For each **filtered** image:
1. Download from LlamaCloud
2. Extract page number from filename
3. Upload to `postparse` bucket
4. Create entry in `figures` table with:
   - `page_number`: extracted page
   - `manual_id`: manual reference
   - `storage_url`: where image lives
   - `ocr_status`: 'pending'
   - `kind`: 'diagram'

**Progress**: 80% → 90%

#### 3D. Metadata Creation (Lines 614-658)
1. Create `manual_metadata` entry
2. Auto-backfill metadata into chunks
3. Create tenant access permissions

**Progress**: 90% → 95%

---

### Step 4: OCR Processing (Automatic & Tracked)
**Location**: supabase/functions/process-all-ocr/index.ts  
**What Happens**:

After webhook completes image storage, OCR automatically starts:

1. **Webhook triggers OCR** - no manual intervention needed
2. **For each figure with `ocr_status = 'pending'`**:
   - Fetch image from storage
   - Send to GPT-4 Vision API
   - Extract all visible text (OCR)
   - Generate embedding for semantic search
   - Update figure with OCR text and embedding
   - Mark as `ocr_status: 'completed'`
3. **Progress tracking** - updates every 5 images
   - Shows "Processing OCR: X/Y figures completed"
   - Progress bar moves from 90% → 100%
   - Database updates in real-time

**This now happens automatically and is fully tracked!**

**Progress**: 90% → 100% (tracked in main progress bar)

---

### Step 5: Manual is Fully Complete
**What "Complete" Now Means**:
- ✅ Text is chunked and embedded
- ✅ Images are downloaded and stored
- ✅ **OCR is complete for all images**
- ✅ All embeddings generated
- ✅ **Everything is searchable**

**Progress shows 100% only when ALL processing is done!**

---

## The Confusion Points

### 1. "Why so many images?"
LlamaCloud extracts **every visual element**, not just diagrams. The webhook filters them, but you still see the total count in processing.

### 2. "Why do I need to do things afterward?"
Currently you need to:
- Wait for OCR to complete (happens async)
- Manually check processing status
- Sometimes retry failed OCR

### 3. "Why aren't images searchable right away?"
Because OCR happens **after** the main upload completes. Images exist but have no text/embeddings yet.

### 4. "What's with the duplicate errors?"
The constraint `figures_manual_figure_unique` prevents duplicate images. Sometimes LlamaCloud sends duplicates or the webhook tries to re-insert existing images.

---

## ✅ FIXED - Improvements Implemented

### What Was Fixed:

1. **✅ Better Progress Tracking**
   - Separate tracking for text (0-90%) vs OCR (90-100%)
   - Clear messages: "Processing OCR: 177/370 figures completed"
   - Only shows "completed" when OCR is actually done
   - Real-time progress updates every 5 images

2. **✅ Automatic OCR Trigger**
   - OCR starts automatically after webhook completes
   - Runs in background via EdgeRuntime.waitUntil()
   - No manual intervention needed
   - Fully integrated into upload workflow

3. **✅ Improved Status Logic**
   - Won't mark as "completed" until ALL OCR finishes
   - Stays at 95% "ocr_processing" until done
   - Handles edge cases (no figures, partial completion)
   - sync-processing-status properly tracks OCR completion

4. **✅ Unified Completion State**
   - Manual is complete when:
     - ✅ Text chunked and embedded
     - ✅ Images stored in Supabase
     - ✅ OCR completed for all figures
     - ✅ All embeddings generated
   - Progress reaches 100% only when everything is done

### Still To Improve (Future):

1. **Retry Failed OCR** - automatic retry logic for failed images
2. **Better Error Messages** - show which specific images failed and why
3. **Clearer Image Counts** - differentiate raw vs filtered image counts in UI

---

## Summary of Current State

**Jurassic Park 2**:
- PDF: ~35 pages
- Raw images from LlamaCloud: 459
- Filtered diagrams kept: 370
- Text processing: ✅ 100% complete
- Image OCR: ⏳ 48% complete (177/370)
- Searchable images: 177 with text/embeddings
- Pending images: 182 without OCR
- Failed images: 10 need retry

**What you see**: "87% complete, 193 images"  
**What it means**: "Text done, but only half the images are searchable"
