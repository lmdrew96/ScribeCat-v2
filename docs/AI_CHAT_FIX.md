# AI Chat Connection Fix

## Issue
AI Chat was not connecting, but Polish and Summarize features worked fine.

## Root Causes
There were TWO critical bugs preventing AI Chat from working:

### Bug #1: Preload IPC Listener Leak
The problem was in `src/preload/preload.ts` in the `chatStream` function (lines 47-52).

### The Bug
```typescript
chatStream: (message: string, history: any[], options: any, onChunk: (chunk: string) => void) => {
  // Set up listener for chunks
  ipcRenderer.on('ai:chatChunk', (_event: any, chunk: string) => onChunk(chunk));
  // Start the stream
  return ipcRenderer.invoke('ai:chatStream', message, history, options);
}
```

**Problems:**
1. **Listener Leaks**: Each call to `chatStream` added a new listener without removing the old one, causing memory leaks and potential conflicts
2. **No Cleanup**: The listener was never removed after the stream completed
3. **Timing Issues**: The listener setup was synchronous but the invoke was asynchronous, which could cause race conditions
4. **Missing Error Handling**: If the stream failed, the listener would remain attached forever

### Why Polish and Summarize Worked
These features use simple `ipcRenderer.invoke()` calls that return Promises directly:
```typescript
polishTranscription: (text: string, options?: any) => 
  ipcRenderer.invoke('ai:polishTranscription', text, options),
```

They don't involve streaming or event listeners, so they worked fine.

### Bug #2: Missing DOM Append
In `src/renderer/ai-manager.ts`, the `sendMessage` function created an assistant message element but **never added it to the DOM**. The streaming response had nowhere to display!

```typescript
// Created the element but never appended it!
const assistantMessageDiv = this.createMessageElement('assistant', '');
const contentDiv = assistantMessageDiv.querySelector('.message-content');
if (contentDiv) {
  contentDiv.classList.add('streaming');
}
// Missing: this.chatMessages.appendChild(assistantMessageDiv);
```

## The Fixes

### Fix #1: Preload IPC Listener Management
```typescript
chatStream: async (message: string, history: any[], options: any, onChunk: (chunk: string) => void) => {
  // Remove any existing listeners first to prevent leaks
  ipcRenderer.removeAllListeners('ai:chatChunk');
  
  // Set up listener for chunks
  const chunkHandler = (_event: any, chunk: string) => onChunk(chunk);
  ipcRenderer.on('ai:chatChunk', chunkHandler);
  
  try {
    // Start the stream
    const result = await ipcRenderer.invoke('ai:chatStream', message, history, options);
    return result;
  } finally {
    // Clean up listener after stream completes
    ipcRenderer.removeListener('ai:chatChunk', chunkHandler);
  }
}
```

**Improvements:**
1. ✅ **Prevents Listener Leaks**: Removes all existing listeners before adding a new one
2. ✅ **Proper Cleanup**: Uses try/finally to ensure the listener is removed even if an error occurs
3. ✅ **Named Handler**: Creates a named handler function so we can remove the specific listener
4. ✅ **Async/Await**: Makes the function async and awaits the result for better error handling
5. ✅ **Guaranteed Cleanup**: The finally block ensures cleanup happens no matter what

## Testing
After rebuilding the preload script with `npm run compile`, the AI Chat should now:
- Connect properly when the API key is configured
- Stream responses in real-time
- Clean up listeners after each message
- Not leak memory over multiple chat sessions

### Fix #2: DOM Append for Assistant Messages
```typescript
// Create assistant message placeholder
const assistantMessageDiv = this.createMessageElement('assistant', '');
const contentDiv = assistantMessageDiv.querySelector('.message-content');
if (contentDiv) {
  contentDiv.classList.add('streaming');
}

// Add the assistant message to the UI immediately
if (this.chatMessages) {
  this.chatMessages.appendChild(assistantMessageDiv);
  // Scroll to bottom
  this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
}
```

**Improvements:**
1. ✅ **Adds message to DOM** - The assistant message is now visible in the chat
2. ✅ **Immediate feedback** - User sees the message placeholder right away
3. ✅ **Auto-scroll** - Chat automatically scrolls to show the new message

## Files Modified
- `src/preload/preload.ts` - Fixed the chatStream IPC listener management
- `src/renderer/ai-manager.ts` - Fixed the missing appendChild for assistant messages

## Date
October 28, 2025
