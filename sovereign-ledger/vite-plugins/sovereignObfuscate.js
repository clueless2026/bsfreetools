import JavaScriptObfuscator from 'javascript-obfuscator'

/**
 * Runs after Rollup emits chunks (post-minify). Scrambles identifiers and string arrays.
 * Keeps React stable: no global rename, no self-defending, no dead-code injection.
 */
export function sovereignObfuscatePlugin() {
  return {
    name: 'sovereign-obfuscate',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk' || !fileName.endsWith('.js')) {
          continue
        }
        if (!chunk.code) {
          continue
        }
        const result = JavaScriptObfuscator.obfuscate(chunk.code, {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.35,
          deadCodeInjection: false,
          identifierNamesGenerator: 'hexadecimal',
          renameGlobals: false,
          renameProperties: false,
          selfDefending: false,
          simplify: true,
          stringArray: true,
          stringArrayEncoding: ['base64'],
          stringArrayThreshold: 0.85,
          splitStrings: true,
          transformObjectKeys: true,
          unicodeEscapeSequence: false,
          target: 'browser',
        })
        chunk.code = result.getObfuscatedCode()
      }
    },
  }
}
