# AI Connection Test Guide

## Issue
When testing the Claude API connection, you're getting "Connection failed" error.

## Steps to Test and Fix

### 1. Enter Your API Key
1. Open ScribeCat
2. Click the Settings (⚙️) button
3. Scroll down to the "Claude AI" section
4. Enter your Claude API key in the input field
5. **Important**: Click "Save Settings" button at the bottom of the settings dialog
6. Wait for the "Settings saved successfully!" notification

### 2. Test the Connection
After saving settings:
1. The settings dialog should close
2. Open Settings again
3. Scroll to Claude AI section
4. Your API key should still be there (it will be masked with dots)
5. Click "Test Connection" button
6. Wait for the result

### 3. Expected Results

**Success:**
- Status changes to "Connected successfully!"
- Status indicator turns green
- AI features become enabled (Polish, Summarize, AI Chat buttons)

**Failure:**
- Status shows "Connection failed"
- Check the following:

## Troubleshooting Steps

### Check 1: Verify API Key is Saved
Open the browser console (View > Developer > Toggle Developer Tools) and check for:
```
Settings saved successfully!
```

### Check 2: Check for Errors
Look in the console for any error messages related to:
- `ai:setApiKey`
- `ai:testConnection`
- Anthropic API errors

### Check 3: Verify API Key Format
Claude API keys should:
- Start with `sk-ant-`
- Be a long string of characters
- Have no extra spaces or line breaks

### Check 4: Check Network Connection
The test connection makes a real API call to Anthropic. Ensure:
- You have internet connectivity
- No firewall is blocking `https://api.anthropic.com`
- No proxy issues

### Check 5: Verify API Key Permissions
In your Anthropic Console:
- Check that the API key is active
- Verify it has the necessary permissions
- Check if there are any usage limits reached

## Manual Testing via Console

You can test the API directly in the browser console:

```javascript
// Test if API is configured
await window.scribeCat.ai.isConfigured()
// Should return: { success: true, data: true }

// Test connection
await window.scribeCat.ai.testConnection()
// Should return: { success: true, data: true }

// If it fails, check the error
await window.scribeCat.ai.testConnection().catch(e => console.error(e))
```

## Common Issues

### Issue 1: API Key Not Saved
**Symptom**: After clicking "Test Connection", status shows "Not configured"
**Solution**: Make sure you clicked "Save Settings" after entering the API key

### Issue 2: Invalid API Key
**Symptom**: Connection test fails immediately
**Solution**: 
- Double-check your API key in Anthropic Console
- Copy it again carefully
- Paste it fresh into the settings

### Issue 3: Network Error
**Symptom**: Connection test times out or shows network error
**Solution**:
- Check your internet connection
- Try accessing https://api.anthropic.com in your browser
- Check firewall/antivirus settings

### Issue 4: Rate Limiting
**Symptom**: Connection works sometimes but fails other times
**Solution**:
- Check your Anthropic Console for rate limit information
- Wait a few minutes and try again

## Debug Mode

To see detailed logs:

1. Open Developer Tools (View > Developer > Toggle Developer Tools)
2. Go to Console tab
3. Try the test connection again
4. Look for detailed error messages

The logs will show:
- When the API key is being set
- When the test connection is called
- Any errors from the Anthropic API
- Response details

## Still Not Working?

If you've tried all the above and it still doesn't work:

1. **Check the main process logs**:
   - Look in the terminal where you ran `npm start`
   - Check for any errors related to ClaudeAIService

2. **Verify the implementation**:
   - Ensure `@anthropic-ai/sdk` is installed: `npm list @anthropic-ai/sdk`
   - Check that the package version is compatible

3. **Try a simple test**:
   ```javascript
   // In browser console
   await window.scribeCat.ai.chat("Hello", [], {})
   ```
   This should return a response if everything is working.

## Success Indicators

When everything is working correctly:
- ✅ Settings save without errors
- ✅ Test connection shows "Connected successfully!"
- ✅ Status indicator is green
- ✅ AI Chat button is enabled (not greyed out)
- ✅ Polish and Summarize buttons are enabled
- ✅ You can open the AI chat panel and send messages

## Next Steps After Successful Connection

Once connected:
1. Try the AI Chat feature
2. Record some audio and test Polish Transcription
3. Test Generate Summary
4. All features should work with streaming responses
