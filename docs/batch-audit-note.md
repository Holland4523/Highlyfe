# Batch Pipeline Audit Note (Focused Hardening)

## Scope audited
- Upload flow: `app/api/upload-processed/route.ts`
- ZIP generation: `app/api/download-batch/route.ts`
- Batch persistence/recovery: `lib/batch-manager.ts`
- Music assignment: `lib/music-library.ts`
- Client render + batch orchestration: `app/page.tsx`

## Root causes identified
1. **Slow processing on phone**
   - Full-size canvas rendering was expensive on large source files.
   - Export settings favored quality without a speed mode.
2. **Audio not reliably included**
   - Previous client pipeline did not consistently mix voice-track audio through exported stream.
3. **Audio/video timing drift**
   - Render stop policy relied mostly on video end, while music could be longer/shorter.
   - No explicit deterministic target duration policy for mixed streams.
4. **State gaps across interruptions**
   - Batch persistence existed, but not all metadata was captured (audio assignment + zip lifecycle).
5. **Batch download fragility perception**
   - ZIP relied on durable URLs but lacked explicit persisted zip status metadata for recovery UI context.

## Focused fixes applied (minimum surface-area)
- Deterministic, seed-based script/audio assignment for reproducibility.
- Audio mixed through WebAudio destination into recorded stream.
- Explicit trim policy to **shortest stream** (`targetDuration = min(videoDuration, adjustedAudioDuration)`).
- Overlay moved ~5% lower than previous values.
- Enforced TikTok 9:16 output canvas with center-crop normalization.
- Added max 20 input guard and file validation.
- Extended batch metadata for assigned track id + zip lifecycle fields.

## Remaining risk
- Browser-side processing still depends on device capability and background throttling behavior (especially iOS).
- True long-batch reliability at 20 files may ultimately require server-side transcoding workers.
