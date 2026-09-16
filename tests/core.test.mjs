import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
import {recipes, planFromPrompt, exportPlugin, escapeHTML, resolveLanguage} from '../website/assets/plugin-core.mjs';

for (const [type, translations] of Object.entries(recipes)) {
  for (const [language, prompt] of Object.entries(translations)) {
    test(`${language} ${type} example selects the matching template`, () => {
      assert.equal(planFromPrompt(prompt).config.type, type);
    });
  }
}
for (const minutes of [1, 12, 25, 120]) {
  test(`focus accepts ${minutes} minutes in both languages`, () => {
    assert.equal(planFromPrompt(`make a ${minutes}-minute focus timer`).config.minutes, minutes);
    assert.equal(planFromPrompt(`做一个${minutes}分钟的番茄钟`).config.minutes, minutes);
  });
}
for (const value of ['0', '121', '-5', '1.5', '1000000']) {
  test(`focus refuses unsupported duration ${value}`, () => {
    assert.equal(planFromPrompt(`make a ${value}-minute timer`).error, 'duration');
  });
}
test('empty, oversized, and unknown ideas are not presented as AI generations', () => {
  assert.equal(planFromPrompt(null).error, 'empty');
  assert.equal(planFromPrompt('   ').error, 'empty');
  assert.equal(planFromPrompt('timer' + 'x'.repeat(500)).error, 'long');
  assert.equal(planFromPrompt('make a weather radar').error, 'unsupported');
});
test('explicit list items support Chinese punctuation and bounded lengths', () => {
  assert.deepEqual(planFromPrompt('清单：写文案，录演示；发布作品。').config.items, ['写文案', '录演示', '发布作品']);
  assert.equal(planFromPrompt('checklist: ' + Array(10).fill('task').join(',')).config.items.length, 6);
  assert.equal(planFromPrompt('checklist: ' + 'x'.repeat(100)).config.items[0].length, 80);
});
test('URL language wins; invalid or unavailable preferences fall back safely', () => {
  assert.equal(resolveLanguage('en', 'zh'), 'en');
  assert.equal(resolveLanguage('zh', 'en'), 'zh');
  assert.equal(resolveLanguage('unknown', 'zh'), 'zh');
  assert.equal(resolveLanguage(null, null), 'en');
  assert.equal(resolveLanguage('__proto__', 'invalid'), 'en');
});
test('HTML escaping covers markup and quotes', () => {
  assert.equal(escapeHTML('<a "x" & \'y\'>'), '&lt;a &quot;x&quot; &amp; &#39;y&#39;&gt;');
});
test('export escapes script terminators and preserves data after JSON parsing', () => {
  const payload = '</script><img src=x onerror=alert(1)>\u2028\u2029';
  const config = {type: 'checklist', minutes: 25, items: [payload]};
  const html = exportPlugin(config, 'zh');
  const json = html.match(/<script type="application\/json" id="config">([\s\S]*?)<\/script>/)[1];
  assert.ok(!json.includes('<'));
  assert.deepEqual(JSON.parse(json).config, config);
  assert.ok(html.includes('lang="zh-CN"'));
  assert.equal((html.match(/<script/g) || []).length, 2);
  assert.ok(!html.includes('<img src=x'));
});
for (const type of Object.keys(recipes)) {
  test(`${type} export is standalone, syntax-valid, and clearly labelled`, () => {
    const html = exportPlugin(planFromPrompt(recipes[type].en).config);
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(html.includes('Not a desktop plugin package'));
    assert.ok(html.includes("connect-src 'none'"));
    assert.ok(!/<script[^>]+src=|<link[^>]+href=/.test(html));
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    assert.doesNotThrow(() => new Script(script));
  });
}
test('landing has relative assets, a static fallback, and no live model claim', () => {
  const html = readFileSync(new URL('../website/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('href="classic.html"'));
  assert.ok(html.includes('<noscript>'));
  assert.ok(html.includes('SIMULATION'));
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(html.includes('assets/playground.mjs'));
  assert.ok(!html.includes('softwareVersion'));
});
