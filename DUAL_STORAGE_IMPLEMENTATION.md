# Dual Storage Implementation for Transcriptions

## Problem

Large transcriptions (1+ hour recordings) were exceeding Supabase's API payload limit (~8-10MB) when stored directly in the database `transcription_text` column, causing sync failures.

## Solution: Dual Storage Strategy

Implemented a **backward-compatible dual storage system** that writes transcriptions to BOTH Supabase Storage AND the database during a migration period.

### How It Works

#### Phase 1: Writing (New Sessions)
When saving a session with transcription:
1. **Try Storage first**: Upload to `transcription-data` bucket at `{userId}/{sessionId}/transcription.json`
2. **Always write to database**: Store in `transcription_text` column (backward compatibility)
3. **Set flag**: `has_transcription = true` only if Storage upload succeeded

```typescript
// In SupabaseSessionRepository.save()
if (session.transcription) {
  // 1. Try Storage upload
  const uploadResult = await storageService.uploadTranscriptionFile(...);
  storageUploadSuccess = uploadResult.success;

  // 2. Always write to database column
  transcription_text: JSON.stringify(session.transcription.toJSON())
  has_transcription: storageUploadSuccess
}
```

#### Phase 2: Reading (All Sessions)
When loading a session with transcription:
1. **Try Storage first**: Check `has_transcription` flag, attempt download from Storage
2. **Fallback to database**: If Storage fails, parse `transcription_text` column
3. **Attach to session**: Use whichever source succeeded

```typescript
// In SupabaseSessionRepository.loadTranscription()
let transcriptionData = null;

// Try Storage first
if (row.has_transcription) {
  const result = await storageService.downloadTranscriptionFile(...);
  if (result.success) transcriptionData = result.data;
}

// Fallback to database
if (!transcriptionData && row.transcription_text) {
  transcriptionData = JSON.parse(row.transcription_text);
}

// Attach to session
if (transcriptionData) {
  session.addTranscription(Transcription.fromJSON(transcriptionData));
}
```

### Key Benefits

✅ **Backward Compatible**: Existing sessions with transcriptions in database still work
✅ **Large File Support**: New large transcriptions use Storage (no size limit)
✅ **Automatic Fallback**: If Storage fails, database column acts as backup
✅ **No Data Loss**: All transcriptions stored in both locations during migration
✅ **Gradual Migration**: Can migrate old data at any time without breaking changes

### Files Modified

1. **SupabaseSessionRepository.ts**
   - Added `transcription_text` back to `SessionRow` interface
   - Updated `save()` to write to both Storage and database
   - Updated `update()` to write to both Storage and database
   - Updated `loadTranscription()` with Storage-first, database-fallback logic
   - Updated `findById()`, `findAll()`, `findDeleted()` to check both sources

2. **SyncManager.ts**
   - Removed duplicate transcription uploads (now handled by repository)
   - Removed duplicate transcription downloads (now handled by repository)
   - Simplified sync logic

3. **SupabaseStorageService.ts**
   - Already had transcription methods (no changes needed)
   - Uses separate `transcription-data` bucket (not `audio-files`)

### Database Schema

The `sessions` table has:
- `transcription_text` (text): JSON string of transcription (existing, kept for fallback)
- `has_transcription` (boolean): TRUE if file exists in Storage
- `transcription_provider` (text): Metadata
- `transcription_language` (text): Metadata
- `transcription_confidence` (real): Metadata
- `transcription_timestamp` (timestamptz): Metadata

### Storage Structure

```
transcription-data/
  {user_id}/
    {session_id}/
      transcription.json
```

Example: `116c6a05-dc79-4bd3-befe-431175e970ac/865ddc29-2504-4b49-a533-4f7295016e3d/transcription.json`

### Migration Path (Future Phase 3)

When ready to fully migrate:

1. **Create migration script** to:
   - Loop through all sessions with `transcription_text`
   - Upload each to Storage
   - Set `has_transcription = true`
   - Verify upload succeeded

2. **After migration completes**:
   - Remove fallback logic from `loadTranscription()`
   - Drop `transcription_text` column from database
   - All transcriptions now in Storage only

3. **Benefits after migration**:
   - Reduced database size
   - Faster queries (no large text columns)
   - Better performance for large transcriptions

### Setup Requirements

1. **Supabase Dashboard**:
   - Create `transcription-data` bucket
   - Configure RLS policies (see `TRANSCRIPTION_BUCKET_SETUP.md`)
   - Set allowed MIME types: `application/json, text/plain`
   - Set file size limit: 10 MB (or higher for very long recordings)

2. **Run Migration** (optional, for adding `has_transcription` column):
   - Execute `supabase/migrations/006_transcription_storage.sql`
   - This adds the column and index, but doesn't move data
   - Data migration happens automatically via dual-write

### Testing

Test scenarios to verify:

1. ✅ **New session with small transcription** (<1MB)
   - Should write to both Storage and database
   - Should load from Storage (faster)
   - Database acts as backup

2. ✅ **New session with large transcription** (>10MB)
   - Should write to both Storage and database
   - Database write might fail due to size, Storage succeeds
   - Loads from Storage successfully

3. ✅ **Existing session** (transcription in database only)
   - `has_transcription = false` or null
   - `transcription_text` has data
   - Loads from database (fallback works)

4. ✅ **Session after Storage bucket created**
   - Has transcription in both locations
   - Loads from Storage (priority)
   - If Storage deleted, loads from database (fallback)

### Recovery

If you need to recover from the dual storage implementation:

1. **Revert to database-only**: Simply remove Storage upload code, keep database write
2. **Transcription recovery script**: `recover-transcription.js` re-transcribes audio files
3. **Database still has copy**: For most sessions, database column has backup

## Summary

This dual storage approach provides:
- **Zero downtime**: No breaking changes
- **Backward compatibility**: Old sessions still work
- **Forward compatibility**: New large sessions work
- **Safety**: Data in two locations during migration
- **Flexibility**: Can migrate at any time

The system automatically handles the complexity, making it transparent to users and other parts of the codebase.
