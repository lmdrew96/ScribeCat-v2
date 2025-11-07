# Transcription Storage Bucket Setup

## Problem
The `audio-files` bucket only accepts audio MIME types. When we try to upload transcription files (text/plain or application/json), they're rejected with "mime type not supported".

## Solution
Create a separate `transcription-data` bucket for storing transcription JSON files.

## Setup Instructions

### 1. Create Bucket in Supabase

1. Go to **Supabase Dashboard** → **Storage**
2. Click **New bucket**
3. Configure:
   - **Name**: `transcription-data`
   - **Public bucket**: OFF (keep private)
   - **Allowed MIME types**: `application/json,text/plain`
   - **File size limit**: 10 MB (transcriptions are typically < 1MB)

### 2. Configure RLS Policies

Run this SQL in **Supabase SQL Editor**:

```sql
-- Enable RLS on the transcription-data bucket
-- Note: Supabase Storage buckets automatically inherit RLS from the storage.objects table

-- Policy: Users can upload their own transcriptions
CREATE POLICY "Users can upload their own transcriptions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'transcription-data' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own transcriptions
CREATE POLICY "Users can read their own transcriptions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'transcription-data' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own transcriptions
CREATE POLICY "Users can update their own transcriptions"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'transcription-data' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own transcriptions
CREATE POLICY "Users can delete their own transcriptions"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'transcription-data' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### 3. Verify Setup

Test that the bucket works:
1. Try uploading a test file through Supabase Dashboard
2. Verify RLS policies prevent unauthorized access
3. Test from your app with a small recording

## Storage Structure

Files will be stored at:
```
transcription-data/
  {user_id}/
    {session_id}/
      transcription.json
```

## Rollback

If you need to remove this bucket:
1. Delete all files in the bucket
2. Drop the bucket from Supabase Dashboard
3. Revert code changes to use database storage
