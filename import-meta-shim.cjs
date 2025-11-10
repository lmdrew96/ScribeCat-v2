// import.meta shim for CommonJS
// This file provides import.meta.url for CJS builds
module.exports = {
  url: typeof __filename !== 'undefined' ? `file://${__filename}` : ''
};
