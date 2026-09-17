import { build } from 'esbuild'
import { mkdir, rm } from 'node:fs/promises'

await rm('lib', { recursive: true, force: true })
await mkdir('lib', { recursive: true })
await build({
  entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true,
  platform: 'node', target: 'node22', format: 'esm', packages: 'external',
})
await build({
  entryPoints: ['src/client/index.tsx'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', target: ['chrome110', 'safari16.4'], format: 'cjs',
  external: ['react', 'react/*', '@deepseek-ai/*'], loader: { '.css': 'text' },
  banner: { js: 'window.__ModuleLoader__.load({ id: "dsh-mobile-workbench", factory: (require) => { const module = { exports: {} }; const exports = module.exports;' },
  footer: { js: 'return module.exports; } });' },
})
