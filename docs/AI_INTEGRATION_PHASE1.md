# AI Integration - Phase 1 Implementation

## Overview
This document describes the implementation of Claude AI integration into ScribeCat-v2, providing intelligent features for transcription enhancement, chat assistance, summaries, and title generation.

## Implementation Date
October 28, 2025

## Architecture

### Clean Architecture Layers

**Domain Layer** (`src/domain/services/IAIService.ts`)
- Defines the `IAIService` interface
- Pure business logic contracts
- No dependencies on external libraries

**Infrastructure Layer** (`src/infrastructure/services/ai/ClaudeAIService.ts`)
- Concrete implementation using Anthropic SDK
- Handles API communication
- Implements all IAIService methods

**Main Process** (`src/main/main.ts`)
- Instantiates ClaudeAIService
- Manages API key securely (never exposed to renderer)
- Provides IPC handlers for renderer communication

**Preload Script** (`src/preload/preload.ts`)
- Exposes safe AI API to renderer via contextBridge
- No direct access to Node.js or Electron APIs from renderer

## Features Implemented

### 1. Core AI Service
- ✅ Claude API integration using `@anthropic-ai/sdk`
- ✅ Secure API key management (main process only)
- ✅ Model: `claude-3-5-sonnet-20241022`
- ✅ Configurable max tokens (default: 4096)
- ✅ Error handling and retry logic

### 2. Chat Interface (Backend Ready)
- ✅ Standard chat with conversation history
- ✅ Streaming chat for real-time responses
- ✅ Context-aware (can include transcription and notes)
- ✅ Configurable temperature and max tokens

### 3. Transcription Polishing (Backend Ready)
- ✅ Grammar correction
- ✅ Punctuation improvement
- ✅ Clarity enhancement
- ✅ Change tracking
- ✅ Meaning preservation option

### 4. Smart Summaries (Backend Ready)
- ✅ Multiple summary styles:
  - Bullet points
  - Paragraph format
  - Key takeaways
  - Action items
- ✅ Configurable length
- ✅ Key points extraction
- ✅ Action items identification

### 5. Title Generation (Backend Ready)
- ✅ Automatic descriptive titles
- ✅ Multiple alternatives provided
- ✅ Format options (descriptive, concise, academic)
- ✅ Configurable max length

## API Methods

### Main Process IPC Handlers

```typescript
// Set API key (secure, main process only)
'ai:setApiKey' -> (apiKey: string) => Promise<IPCResponse<void>>

// Check configuration status
'ai:isConfigured' -> () => Promise<IPCResponse<boolean>>

// Test API connection
'ai:testConnection' -> () => Promise<IPCResponse<boolean>>

// Chat (non-streaming)
'ai:chat' -> (message: string, history: ChatMessage[], options?: ChatOptions) 
  => Promise<IPCResponse<ChatResponse>>

// Chat (streaming)
'ai:chatStream' -> (message: string, history: ChatMessage[], options: ChatOptions)
  => Promise<IPCResponse<void>>
// Emits: 'ai:chatChunk' events with string chunks

// Polish transcription
'ai:polishTranscription' -> (text: string, options?: PolishOptions)
  => Promise<IPCResponse<PolishResult>>

// Generate summary
'ai:generateSummary' -> (transcription: string, notes?: string, options?: SummaryOptions)
  => Promise<IPCResponse<SummaryResult>>

// Generate title
'ai:generateTitle' -> (transcription: string, notes?: string, options?: TitleOptions)
  => Promise<IPCResponse<TitleResult>>
```

### Renderer API (via window.scribeCat.ai)

```typescript
window.scribeCat.ai.setApiKey(apiKey: string)
window.scribeCat.ai.isConfigured()
window.scribeCat.ai.testConnection()
window.scribeCat.ai.chat(message, history, options)
window.scribeCat.ai.chatStream(message, history, options, onChunk)
window.scribeCat.ai.removeChatStreamListener()
window.scribeCat.ai.polishTranscription(text, options)
window.scribeCat.ai.generateSummary(transcription, notes, options)
window.scribeCat.ai.generateTitle(transcription, notes, options)
```

## Security Considerations

### ✅ Implemented Security Measures

1. **API Key Protection**
   - API key stored only in main process
   - Never exposed to renderer process
   - All API calls made from main process

2. **Context Isolation**
   - Renderer has no direct access to Node.js
   - Communication only via secure IPC
   - contextBridge used for safe API exposure

3. **Content Security Policy**
   - CSP updated to allow `https://api.anthropic.com`
   - No inline scripts except where necessary
   - Strict CSP for all other resources

4. **Input Validation**
   - API key validation before service initialization
   - Error handling for all API calls
   - Type safety with TypeScript

## Data Flow

```
User Input (Renderer)
    ↓
window.scribeCat.ai.* (Preload)
    ↓
IPC Channel (Secure)
    ↓
Main Process Handler
    ↓
ClaudeAIService (Infrastructure)
    ↓
Anthropic API (HTTPS)
    ↓
Response back through IPC
    ↓
Renderer receives result
```

## Configuration

### API Key Storage
- Stored via electron-store (encrypted by OS)
- Key: `'claude-api-key'`
- Retrieved on app startup if present

### Default Settings
```typescript
{
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4096,
  maxRetries: 3,
  temperature: 0.7 (chat), 0.3 (polish), 0.5 (summary)
}
```

## Token Usage Tracking

All AI operations return `tokensUsed` in their responses:
- `ChatResponse.tokensUsed`
- `PolishResult.tokensUsed`
- `SummaryResult.tokensUsed`
- `TitleResult.tokensUsed`

This allows for usage monitoring and cost tracking.

## Error Handling

### Error Types
1. **Configuration Errors**: API key not set
2. **Network Errors**: Connection failures
3. **API Errors**: Rate limits, invalid requests
4. **Parsing Errors**: Unexpected response format

### Error Response Format
```typescript
{
  success: false,
  error: "Human-readable error message"
}
```

## Next Steps (UI Implementation)

### To Be Implemented
1. **AI Settings Panel**
   - API key input field
   - Connection test button
   - Status indicator

2. **Chat Interface**
   - Collapsible chat panel
   - Message history display
   - Streaming response visualization
   - Context toggle (include transcription/notes)

3. **Transcription Polish UI**
   - "Polish" button in transcription panel
   - Before/after comparison
   - Accept/reject changes
   - Options checkboxes

4. **Summary Generation UI**
   - "Summarize" button
   - Style selector
   - Summary display panel
   - Copy to notes option

5. **Title Generation UI**
   - Auto-suggest on save
   - Alternative titles list
   - Quick accept/edit

## Testing Checklist

- [ ] API key configuration
- [ ] Connection testing
- [ ] Chat functionality (non-streaming)
- [ ] Chat streaming
- [ ] Transcription polishing
- [ ] Summary generation (all styles)
- [ ] Title generation
- [ ] Error handling
- [ ] Token usage tracking
- [ ] Security validation

## Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.x.x"
}
```

## Files Modified/Created

### Created
- `src/domain/services/IAIService.ts`
- `src/infrastructure/services/ai/ClaudeAIService.ts`
- `docs/AI_INTEGRATION_PHASE1.md`

### Modified
- `src/main/main.ts` - Added AI service and IPC handlers
- `src/preload/preload.ts` - Exposed AI API
- `src/shared/types.ts` - Added AI types
- `src/renderer/index.html` - Updated CSP
- `package.json` - Added @anthropic-ai/sdk

## Performance Considerations

1. **Lazy Initialization**: AI service only created when API key is set
2. **Streaming**: Large responses use streaming to improve perceived performance
3. **Context Management**: Only relevant context sent to API (truncated if needed)
4. **Caching**: Consider implementing response caching for repeated queries (future)

## Rate Limiting

The Anthropic API has rate limits. The service includes:
- Automatic retry with exponential backoff (maxRetries: 3)
- Error messages for rate limit issues
- Graceful degradation when API unavailable

## Future Enhancements

1. **Response Caching**: Cache common queries
2. **Batch Operations**: Process multiple items efficiently
3. **Custom Prompts**: Allow users to customize AI behavior
4. **Usage Analytics**: Track and display token usage over time
5. **Offline Mode**: Graceful handling when API unavailable
6. **Model Selection**: Allow users to choose different Claude models
