import { gzipSync } from 'node:zlib';

// Follow only static imports: dynamic routes, dialogs and locales are fetched on demand.
export function analyzeFrontendBundle(output) {
  const files = new Map(output.map((file) => [file.fileName, file]));
  const entry = output.find((file) => file.type === 'chunk' && file.isEntry);
  if (!entry) throw new Error('Missing frontend entry chunk');

  function closure(roots) {
    const visited = new Set();
    function visit(name) {
      if (visited.has(name)) return;
      const file = files.get(name);
      if (!file) throw new Error(`Missing build output: ${name}`);
      visited.add(name);
      if (file.type === 'chunk') {
        file.imports.forEach(visit);
        file.viteMetadata?.importedCss.forEach(visit);
      }
    }
    roots.forEach(visit);
    return visited;
  }

  function chunkFor(source) {
    const file = output.find((file) => file.type === 'chunk' && file.facadeModuleId?.endsWith(source));
    if (!file) throw new Error(`Missing chunk for ${source}`);
    return file.fileName;
  }

  function size(names) {
    let raw = 0;
    let gzip = 0;
    for (const name of names) {
      const file = files.get(name);
      const bytes = Buffer.from(file.type === 'chunk' ? file.code : file.source);
      raw += bytes.length;
      gzip += gzipSync(bytes).length;
    }
    return { raw, gzip, files: names.size };
  }

  function modules(names) {
    return [...names].flatMap((name) => Object.keys(files.get(name).modules || {}));
  }

  const localeSources = ['/src/locales/zh-CN.js', '/src/locales/zh-TW.js', '/src/locales/en-US.js'];
  function pageFiles(page, locale) {
    return closure([entry.fileName, 'index.html', chunkFor(`/src/pages/${page}.vue`), chunkFor(locale)]);
  }
  const pages = Object.fromEntries(['LoginPage', 'ChatPage'].map((page) => [
    page,
    Object.fromEntries(localeSources.map((locale) => [locale.split('/').at(-1).slice(0, -3), size(pageFiles(page, locale))]))
  ]));
  const all = new Set(files.keys());
  // This is the complete compiled JS/CSS/HTML, including all locales and the editor chunk.
  // The self-hosted Lute runtime in public/vendor is reported separately by the CLI.
  return { pages, compiled: size(all), closure, chunkFor, pageFiles, modules, size, files };
}
