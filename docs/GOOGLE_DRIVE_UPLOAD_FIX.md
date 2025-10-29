# Google Drive Upload Fix

## Issue
The Google Drive upload feature wasn't actually creating files in Google Drive when users selected the "Upload to Google Drive after export" option.

## Root Cause
The IPC handler in `main.ts` was wrapping the `GoogleDriveService.uploadFile()` result in an extra layer:

```typescript
// Before (incorrect):
const result = await this.googleDriveService.uploadFile(filePath, options);
return { success: true, data: result }; // ❌ Double-wrapped result
```

This meant the export-manager was checking `uploadResult.success` but the actual result was nested in `uploadResult.data.success`.

## Changes Made

### 1. Fixed IPC Response Structure (`src/main/main.ts`)
**Changed:** The `drive:uploadFile` IPC handler now returns the result directly instead of wrapping it:

```typescript
// After (correct):
const result = await this.googleDriveService.uploadFile(filePath, options);
return result; // ✅ Direct return of { success, fileId, webViewLink, error }
```

### 2. Improved Export Manager (`src/renderer/export-manager.ts`)
**Changes:**
- Removed hardcoded `/tmp/` path - now uses relative path that the export service handles properly
- Added better error messages specifically for Drive upload failures
- Added success message with Drive link when upload succeeds
- Improved progress feedback during upload

**Before:**
```typescript
const outputPath = `/tmp/${filename}.${format}`; // ❌ Hardcoded temp path
```

**After:**
```typescript
const outputPath = `${filename}.${format}`; // ✅ Let export service handle path
```

### 3. Fixed TypeScript Types (`src/shared/window.d.ts`)
**Changed:** Updated the `drive.uploadFile` return type to match the actual `GoogleDriveUploadResult`:

```typescript
// Before:
uploadFile: (filePath: string, options: any) => Promise<{ success: boolean; data?: any; error?: string }>;

// After:
uploadFile: (filePath: string, options: any) => Promise<{ success: boolean; fileId?: string; webViewLink?: string; error?: string }>;
```

## How It Works Now

1. User exports a session and checks "Upload to Google Drive after export"
2. Export service creates the file locally
3. File path is passed to `GoogleDriveService.uploadFile()`
4. Google Drive API uploads the file and returns `{ success: true, fileId, webViewLink }`
5. IPC handler returns this result directly (no wrapping)
6. Export manager receives the result and can access `uploadResult.webViewLink`
7. User sees success message with link to view file in Drive

## Testing Checklist

- [ ] Export a session without Drive upload (local only)
- [ ] Export a session with Drive upload enabled
- [ ] Verify file appears in Google Drive
- [ ] Verify success message shows Drive link
- [ ] Test with different export formats (txt, docx, pdf, html)
- [ ] Test error handling when Drive is not authenticated
- [ ] Test error handling when upload fails

## Related Files
- `src/main/main.ts` - IPC handler fix
- `src/renderer/export-manager.ts` - UI and upload logic
- `src/shared/window.d.ts` - Type definitions
- `src/infrastructure/services/drive/GoogleDriveService.ts` - Drive API integration (unchanged)
- `src/domain/services/IGoogleDriveService.ts` - Interface definition (unchanged)

## Notes
- The fix maintains backward compatibility with local-only exports
- Error messages are now more specific and helpful
- Users get a clickable link to view their uploaded file
- The temporary file handling is now more robust
