import test from 'node:test';
import assert from 'node:assert/strict';
import {configureSite} from '../scripts/configure-site.mjs';
const html='<html><head><meta property="og:image" content="assets/share-workbench.jpg"></head><body></body></html>';
test('site metadata uses the explicitly supplied repository subpath',() => {
  const out=configureSite(html,'https://example.com/a/project/');
  assert.ok(out.html.includes('https://example.com/a/project/assets/share-workbench.jpg'));
  assert.ok(out.robots.includes('https://example.com/a/project/sitemap.xml'));
  assert.ok(out.sitemap.includes('<loc>https://example.com/a/project/</loc>'));
});
test('reconfiguring a deployment replaces old canonical and image URLs',() => {
  const once=configureSite(html,'https://example.com/old/');
  const twice=configureSite(once.html,'https://example.com/new/');
  assert.ok(!twice.html.includes('/old/'));
  assert.equal((twice.html.match(/rel="canonical"/g)||[]).length,1);
  assert.equal((twice.html.match(/property="og:url"/g)||[]).length,1);
});
test('unconfirmed or non-root deployment arguments fail closed',() => {
  for(const url of ['not a url','http://localhost:4173/','https://a.com/index.html','https://u:p@a.com/','https://a.com/?x=1','https://a.com/#section']) {
    assert.throws(()=>configureSite(html,url));
  }
});
