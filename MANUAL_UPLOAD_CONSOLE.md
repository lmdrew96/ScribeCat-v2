# Manual Upload via Browser Console

Since the session isn't uploading automatically, you can manually trigger the upload from ScribeCat's DevTools console.

## Steps

1. **Open Dev Tools** in ScribeCat (View → Toggle Developer Tools or Cmd+Option+I)

2. **Go to Console tab**

3. **Run this command:**

```javascript
// Manual upload for session 865ddc29-2504-4b49-a533-4f7295016e3d
const sessionId = '865ddc29-2504-4b49-a533-4f7295016e3d';

window.scribeCat.sync.uploadSession(sessionId).then(result => {
  console.log('Upload result:', result);
  if (result.success) {
    console.log('✅ Session uploaded successfully!');
  } else {
    console.error('❌ Upload failed:', result.error);
  }
}).catch(error => {
  console.error('❌ Upload error:', error);
});
```

## Alternative: Check if session needs manual sync button

The yellow/orange cloud badge might mean the session failed to sync. Try:

1. **Right-click on the session card**
2. Look for options like:
   - "Upload to Cloud"
   - "Retry Sync"
   - "Push to Cloud"

## If that doesn't work:

The session might need to be in the correct state. Let me know what error you see in the console and we can troubleshoot from there!
