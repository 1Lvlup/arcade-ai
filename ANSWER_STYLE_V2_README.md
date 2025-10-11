# Answer Style V2 - Evidence-Based Response Quality

This feature implements intelligent prompt adaptation based on retrieval quality, providing better responses when manual evidence is weak or strong.

## How It Works

### 1. Evidence Quality Signals
The system computes three metrics from your Cohere reranked results:
- **Top Score**: The highest rerank score from retrieved chunks
- **Avg Top 3**: Average of the top 3 chunk scores
- **Strong Hits**: Count of chunks above the minimum threshold

### 2. Prompt Adaptation
Based on these signals, the system adjusts:
- **System prompt**: Adds guidance about evidence quality
- **Response style**: Encourages "working theory" language when evidence is thin
- **Citation behavior**: Promotes inline doc mentions when evidence is strong

### 3. Merged Detection
The new thresholds work alongside your existing weak detection logic:
```
isWeak = existingWeak OR (topScore < 0.62 OR avgTop3 < 0.58 OR strongHits < 2)
```

## Setup

### 1. Enable the Feature
Add this secret to Supabase (Edge Functions):
```bash
ANSWER_STYLE_V2=1
```

When set to `0` or unset, the system uses your existing behavior (no changes).

### 2. Optional: Tune Thresholds
Add these secrets to calibrate for your Cohere scores:
```bash
RETRIEVAL_MIN_TOP_SCORE=0.62    # Minimum acceptable top chunk score
RETRIEVAL_WEAK_AVG=0.58         # Minimum average of top 3 chunks
RETRIEVAL_MIN_STRONG=2          # Minimum number of "strong" hits required
```

## Calibration Guide

### Step 1: Baseline Testing
1. Set `ANSWER_STYLE_V2=1`
2. Keep default thresholds (0.62, 0.58, 2)
3. Test 10-20 real queries
4. Check edge function logs for signal values

### Step 2: Find Your Thresholds
Look at the logs for queries where answers felt:
- ✅ **Solid**: Note the top score and avgTop3
- ⚠️ **Iffy**: Note those values too

Your sweet spot thresholds:
- `RETRIEVAL_MIN_TOP_SCORE` = ~70th percentile of "solid" top scores
- `RETRIEVAL_WEAK_AVG` = ~70th percentile of "solid" avgTop3 values
- `RETRIEVAL_MIN_STRONG` = typical "strong hit" count for good answers (usually 2-3)

### Step 3: Adjust
Update the secrets in Supabase, no code changes needed.

## Log Example

When Answer Style V2 is active, you'll see:
```
📊 [Answer Style V2] Weak: false, Top: 0.847, Avg3: 0.763, Strong: 4
```

This helps you understand:
- Whether weak mode triggered
- The actual signal values
- How many chunks passed the threshold

## Rollback

To disable, simply set:
```bash
ANSWER_STYLE_V2=0
```

Your system reverts to the original conversational/structured style toggle.

## Files Added
- `supabase/functions/_shared/answerStyle.ts` - Core logic for signals and prompt shaping
- `ANSWER_STYLE_V2_README.md` - This documentation

## Files Modified
- `supabase/functions/chat-manual/index.ts` - Added V2 integration with feature flag
