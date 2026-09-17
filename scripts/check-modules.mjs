// Link the actual native ES-module graph without replacing imports or executing DOM code.
// This complements DOM fixtures; it does not claim to test browser HTTP or CSP.
import {SourceTextModule} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('../website/', import.meta.url);
const modules = new Map();
async function getModule(url) {
  if (!url.href.startsWith(root.href)) throw new Error(`Import escapes website: ${url.href}`);
  if (!modules.has(url.href)) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    modules.set(url.href, new SourceTextModule(source, {identifier: url.href}));
  }
  return modules.get(url.href);
}
const entry = await getModule(new URL('assets/playground.mjs', root));
await entry.link(async (specifier, parent) => {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) throw new Error(`Non-local import: ${specifier}`);
  return getModule(new URL(specifier, parent.identifier));
});
console.log(JSON.stringify({status: 'PASS', mode: 'ES_MODULE_LINK_ONLY', count: modules.size,
  modules: [...modules.keys()].map(url => url.slice(root.href.length)),
  limitations: 'Does not execute a browser, fetch HTTP modules, or validate CSP.'}, null, 2));
