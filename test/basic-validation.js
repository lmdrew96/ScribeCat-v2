/**
 * Basic validation test for Phase 2 implementation
 * This tests the structure and basic functionality of the main process modules
 */

const fs = require('fs');
const path = require('path');

console.log('=== Phase 2 Basic Validation Test ===\n');

// Test 1: Verify all source files exist
console.log('Test 1: Checking source files...');
const sourceFiles = [
  'src/main/main.ts',
  'src/main/recording-manager.ts',
  'src/main/file-manager.ts',
  'src/main/transcription-manager.ts',
  'src/preload/preload.ts',
  'src/renderer/app.ts',
  'src/renderer/index.html',
  'src/renderer/styles.css',
  'src/shared/types.ts'
];

let allFilesExist = true;
sourceFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (allFilesExist) {
  console.log('✓ All source files exist\n');
} else {
  console.log('✗ Some source files are missing\n');
  process.exit(1);
}

// Test 2: Verify compiled files exist
console.log('Test 2: Checking compiled files...');
const compiledFiles = [
  'dist/main/main.js',
  'dist/main/recording-manager.js',
  'dist/main/file-manager.js',
  'dist/main/transcription-manager.js',
  'dist/preload/preload.js',
  'dist/renderer/app.js',
  'dist/renderer/index.html',
  'dist/renderer/styles.css',
  'dist/shared/types.js'
];

let allCompiledExist = true;
compiledFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allCompiledExist = false;
});

if (allCompiledExist) {
  console.log('✓ All compiled files exist\n');
} else {
  console.log('✗ Some compiled files are missing\n');
  process.exit(1);
}

// Test 3: Verify TypeScript interfaces are properly defined
console.log('Test 3: Checking TypeScript types...');
const typesContent = fs.readFileSync('src/shared/types.ts', 'utf8');
const requiredInterfaces = [
  'SessionData',
  'RecordingState',
  'Course',
  'Assignment',
  'Theme',
  'StudyAid'
];

let allInterfacesFound = true;
requiredInterfaces.forEach(interfaceName => {
  const found = typesContent.includes(`interface ${interfaceName}`);
  console.log(`  ${found ? '✓' : '✗'} ${interfaceName}`);
  if (!found) allInterfacesFound = false;
});

if (allInterfacesFound) {
  console.log('✓ All TypeScript interfaces are defined\n');
} else {
  console.log('✗ Some TypeScript interfaces are missing\n');
  process.exit(1);
}

// Test 4: Verify IPC handlers are set up
console.log('Test 4: Checking IPC handlers...');
const preloadContent = fs.readFileSync('src/preload/preload.ts', 'utf8');
const requiredIPCHandlers = [
  'recording:start',
  'recording:stop',
  'recording:pause',
  'recording:resume',
  'recording:getStatus',
  'files:save',
  'files:load',
  'files:list',
  'files:delete',
  'files:export',
  'transcription:transcribe',
  'transcription:enhance',
  'transcription:getStatus'
];

let allHandlersFound = true;
requiredIPCHandlers.forEach(handler => {
  const found = preloadContent.includes(`'${handler}'`);
  console.log(`  ${found ? '✓' : '✗'} ${handler}`);
  if (!found) allHandlersFound = false;
});

if (allHandlersFound) {
  console.log('✓ All IPC handlers are defined\n');
} else {
  console.log('✗ Some IPC handlers are missing\n');
  process.exit(1);
}

// Test 5: Verify HTML structure
console.log('Test 5: Checking HTML structure...');
const htmlContent = fs.readFileSync('src/renderer/index.html', 'utf8');
const requiredElements = [
  'record-btn',
  'recording-status',
  'vu-meter',
  'session-list',
  'session-info',
  'notes-editor'
];

let allElementsFound = true;
requiredElements.forEach(elementId => {
  const found = htmlContent.includes(`id="${elementId}"`);
  console.log(`  ${found ? '✓' : '✗'} ${elementId}`);
  if (!found) allElementsFound = false;
});

if (allElementsFound) {
  console.log('✓ All required HTML elements exist\n');
} else {
  console.log('✗ Some HTML elements are missing\n');
  process.exit(1);
}

// Test 6: Verify CSS classes
console.log('Test 6: Checking CSS classes...');
const cssContent = fs.readFileSync('src/renderer/styles.css', 'utf8');
const requiredClasses = [
  'vu-meter',
  'vu-meter-container',
  'session-list',
  'session-item',
  'session-info',
  'content-area',
  'error-message',
  'success-message'
];

let allClassesFound = true;
requiredClasses.forEach(className => {
  const found = cssContent.includes(`.${className}`);
  console.log(`  ${found ? '✓' : '✗'} ${className}`);
  if (!found) allClassesFound = false;
});

if (allClassesFound) {
  console.log('✓ All required CSS classes exist\n');
} else {
  console.log('✗ Some CSS classes are missing\n');
  process.exit(1);
}

// Test 7: Verify .gitignore includes data directories
console.log('Test 7: Checking .gitignore...');
const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
const requiredIgnores = [
  'recordings/',
  'sessions/',
  'exports/',
  'models/'
];

let allIgnoresFound = true;
requiredIgnores.forEach(ignore => {
  const found = gitignoreContent.includes(ignore);
  console.log(`  ${found ? '✓' : '✗'} ${ignore}`);
  if (!found) allIgnoresFound = false;
});

if (allIgnoresFound) {
  console.log('✓ All data directories are in .gitignore\n');
} else {
  console.log('✗ Some data directories are missing from .gitignore\n');
  process.exit(1);
}

// Final summary
console.log('=== Test Summary ===');
console.log('✓ All validation tests passed!');
console.log('✓ Phase 2 implementation is structurally complete');
console.log('\nNote: Manual testing is required to verify runtime behavior');
console.log('See PHASE2_TESTING.md for detailed testing instructions');
