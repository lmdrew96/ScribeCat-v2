# AssemblyAI 422 Error - API Key Configuration

## Error
```
Failed to get token: 422
```

## Cause
A 422 (Unprocessable Entity) error from the AssemblyAI token endpoint typically indicates one of the following issues:

1. **Invalid API Key Format**: The API key is malformed or incomplete
2. **Missing API Key**: No API key was provided
3. **Incorrect API Key**: The API key doesn't exist or has been revoked

## How to Fix

### 1. Verify Your API Key

1. Log in to your AssemblyAI account at https://www.assemblyai.com/
2. Navigate to your dashboard
3. Copy your API key (it should start with a specific prefix and be a long alphanumeric string)

### 2. Configure in ScribeCat

The API key should be entered in the Settings page:

1. Open ScribeCat
2. Click the Settings icon (⚙️)
3. Find the "AssemblyAI API Key" field
4. Paste your complete API key
5. Save settings

### 3. API Key Format

The API key should be provided **exactly as shown** in your AssemblyAI dashboard:
- Do NOT add "Bearer " prefix
- Do NOT add quotes around it
- Do NOT modify it in any way
- Include the complete string

Example format (not a real key):
```
1234567890abcdef1234567890abcdef
```

## Testing the Fix

After configuring your API key:

1. Restart ScribeCat (close and reopen)
2. Start a new recording with AssemblyAI transcription enabled
3. Check the terminal/console for:
   - ✅ "AssemblyAI token generated successfully" - Success!
   - ❌ "AssemblyAI token error: 422" - API key still incorrect

## Debugging

If you continue to see 422 errors after verifying your API key:

1. Check the main process console output for detailed error messages
2. The error will now include the full response from AssemblyAI
3. Look for messages like:
   ```
   ❌ AssemblyAI token error: 422 {"error": "Invalid API key"}
   ```

## Common Mistakes

❌ **Wrong**: Adding "Bearer" prefix
```
Bearer 1234567890abcdef1234567890abcdef
```

❌ **Wrong**: Adding quotes
```
"1234567890abcdef1234567890abcdef"
```

❌ **Wrong**: Partial key
```
1234567890abcd...
```

✅ **Correct**: Raw API key exactly as provided
```
1234567890abcdef1234567890abcdef
```

## Next Steps

Once the API key is correctly configured:
- The token generation will succeed
- You'll see "✅ AssemblyAI token generated successfully" in the console
- Real-time transcription will begin working
- The 403 error should be completely resolved

## Related Documentation

- [AssemblyAI Temp Token Fix](./ASSEMBLYAI_TEMP_TOKEN_FIX.md)
- [AssemblyAI 403 Issue](./ASSEMBLYAI_403_ISSUE.md)
- [Browser Limitation](./ASSEMBLYAI_BROWSER_LIMITATION.md)
