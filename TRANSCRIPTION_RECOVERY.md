# Transcription Recovery Guide

## What Happened
During testing of the transcription storage changes, your session data may have been partially overwritten. This happened because:
1. The new code tried to load transcription from Storage (which doesn't exist yet)
2. When it failed, it left the transcription field empty
3. This empty version may have been saved back to local storage

## Recovery Steps

### Option 1: Check Supabase Database (Most Likely to Work)

The transcription might still exist in Supabase's `transcription_text` column. To check:

1. Open your Supabase Dashboard: https://djlvwxmakxaffdqbuwkv.supabase.co
2. Go to SQL Editor
3. Run this query:

```sql
SELECT id, title, created_at,
       LENGTH(transcription_text) as transcription_length,
       LEFT(transcription_text, 200) as transcription_preview
FROM sessions
WHERE id = '3c5228f2-aac7-46a5-a65c-118cabbb71fc'
  AND user_id = auth.uid();
```

If this returns data, the transcription is still there! You can recover it with:

```sql
SELECT transcription_text
FROM sessions
WHERE id = '3c5228f2-aac7-46a5-a65c-118cabbb71fc'
  AND user_id = auth.uid();
```

Copy the result and save it to a file.

### Option 2: Check All Sessions with Transcriptions

If the session ID is wrong, find all your sessions with transcriptions:

```sql
SELECT id, title, created_at,
       LEFT(notes, 100) as notes_preview,
       LENGTH(transcription_text) as transcription_length
FROM sessions
WHERE user_id = auth.uid()
  AND transcription_text IS NOT NULL
  AND transcription_text != ''
ORDER BY created_at DESC;
```

Look for the one matching your notes about "Chapter 29/30 Review".

### Option 3: Time Machine Backup

If you have Time Machine enabled:

1. Open Time Machine
2. Navigate to: `/Users/nae/Library/Application Support/`
3. Look for ScribeCat or Electron app data folders
4. Go back to before the testing (this morning)
5. Restore the session files

### Option 4: Check Local SQLite (if using local db)

The app might have a local SQLite database cache. Check:

```bash
find "$HOME/Library/Application Support" -name "*.db" -o -name "*.sqlite"
```

## Prevention Going Forward

Before deploying the new transcription storage system:

1. **BACKUP FIRST**: Export all sessions or backup Supabase database
2. **Create Migration Script**: Write a data migration script to move existing transcriptions to Storage
3. **Test on Copy**: Test on a database copy, not production
4. **Rollback Plan**: Keep transcription_text column until 100% sure all data is migrated

## Immediate Action

DON'T:
- Don't rebuild/restart the app yet
- Don't try to sync any more sessions
- Don't delete anything

DO:
- Check Supabase database immediately using Option 1
- If found, save the transcription_text to a file
- We can then restore it to your local session
