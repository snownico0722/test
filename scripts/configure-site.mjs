// Optional pre-publication metadata step. Does not upload or deploy anything.
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export function configureSite(html, address) {
  const url = new URL(address);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) {
    throw new TypeError('Use the confirmed HTTPS site root, ending in /, without credentials, query or fragment.');
  }
  const base = url.href;
  const escape = value => value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  let output = html.replace(/\s*<link\s+rel="canonical"[^>]*>/gi,'')
    .replace(/\s*<meta\s+property="og:url"[^>]*>/gi,'')
    .replace(/\s*<meta\s+name="twitter:image"[^>]*>/gi,'');
  output = output.replace(/(<meta\s+property="og:image"\s+content=")[^"]*("[^>]*>)/i,`$1${escape(new URL('assets/share-workbench.jpg',base).href)}$2`);
  output = output.replace('</head>', `  <link rel="canonical" href="${escape(base)}">\n  <meta property="og:url" content="${escape(base)}">\n  <meta name="twitter:image" content="${escape(new URL('assets/share-workbench.jpg',base).href)}">\n</head>`);
  return {
    html: output,
    robots: `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml',base).href}\n`,
    sitemap: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(base)}</loc></url></urlset>\n`
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node scripts/configure-site.mjs https://your-confirmed-site.example/project/');
    const website = resolve(dirname(fileURLToPath(import.meta.url)),'../website');
    const files = configureSite(readFileSync(resolve(website,'index.html'),'utf8'),process.argv[2]);
    writeFileSync(resolve(website,'index.html'),files.html);
    writeFileSync(resolve(website,'robots.txt'),files.robots);
    writeFileSync(resolve(website,'sitemap.xml'),files.sitemap);
    console.log('Updated local canonical, share image, robots and sitemap. Nothing has been published.');
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}
