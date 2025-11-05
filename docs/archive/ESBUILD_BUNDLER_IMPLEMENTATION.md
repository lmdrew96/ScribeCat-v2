# esbuild Bundler Implementation

## Overview
Added esbuild bundler to properly handle npm module imports in the renderer process, specifically to resolve the `vosk-browser` package import issue.

## Problem Solved
Previously, the renderer process used plain `tsc` compilation which doesn't bundle npm modules. The browser couldn't resolve npm package names like 'vosk-browser', causing module resolution errors.

## Solution Implemented

### 1. Installed esbuild
```bash
npm install --save-dev esbuild
```

### 2. Created Build Script
**File:** `build-renderer.js`

This script:
- Bundles `src/renderer/app.ts` and all its dependencies into a single `dist/renderer/app.js`
- Uses ES module format for browser compatibility
- Excludes `electron` from bundling (it's provided by Electron runtime)
- Generates source maps for debugging
- Copies HTML and CSS files to dist directory

### 3. Updated package.json Scripts
Changed the `compile` script from:
```json
"compile": "tsc && tsc -p tsconfig.preload.json && cp src/renderer/index.html dist/renderer/ && cp src/renderer/styles.css dist/renderer/"
```

To:
```json
"compile": "tsc && tsc -p tsconfig.preload.json && node build-renderer.js"
```

### 4. Verified Existing Code
- ✅ `index.html` already loads `app.js` correctly
- ✅ `vosk-transcription-service.ts` uses proper ES module import: `import { createModel } from 'vosk-browser'`
- ✅ All renderer imports use `.js` extensions as required for ES modules

## Results

### Build Output
- **Bundled file size:** 5.6MB (includes vosk-browser and all dependencies)
- **Source map:** 5.7MB for debugging
- **Build time:** Fast (milliseconds with esbuild)

### Benefits
✅ Resolves npm package imports properly  
✅ Bundles all dependencies into single file  
✅ Fast compilation (esbuild is extremely fast)  
✅ Works with Electron  
✅ Proper ES modules support  
✅ Source maps for debugging  
✅ No module resolution errors  

## Testing
Tested with `npm run dev`:
- ✅ Application launches successfully
- ✅ No module resolution errors
- ✅ Vosk model server starts properly
- ✅ All renderer functionality works

## Technical Details

### esbuild Configuration
```javascript
{
  entryPoints: ['src/renderer/app.ts'],
  bundle: true,
  outfile: 'dist/renderer/app.js',
  platform: 'browser',
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  external: ['electron'],
  loader: { '.ts': 'ts' }
}
```

### Why esbuild?
- **Fast:** Written in Go, extremely fast compilation
- **Simple:** Minimal configuration needed
- **ES Modules:** Native support for modern JavaScript
- **TypeScript:** Built-in TypeScript support
- **Bundling:** Handles npm module resolution automatically

## Alternative Considered
If vosk-browser had bundling issues, we could have used:
```javascript
external: ['electron', 'vosk-browser']
```
And loaded vosk-browser via importmap in HTML. However, bundling works perfectly.

## Maintenance Notes
- The build script is simple and requires minimal maintenance
- esbuild handles most edge cases automatically
- If new npm packages are added to renderer, they'll be bundled automatically
- Only `electron` is excluded from bundling (as it should be)

## Date Implemented
October 22, 2025
