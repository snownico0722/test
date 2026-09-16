"""Run with a local server at :4173; see README for the optional offline DOM mode."""
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from browser_loader import load_page, ROOT

class PlaygroundTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        cls.browser = cls.playwright.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', accept_downloads=True)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        load_page(self.page)
        self.page.wait_for_selector('.paper')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Uncaught browser errors')

    def build(self, recipe='focus', prompt=None):
        self.page.locator(f'[data-recipe="{recipe}"]').click()
        if prompt is not None:
            self.page.locator('#prompt').fill(prompt)
        self.page.locator('#build').click()
        expect(self.page.locator('#install')).to_be_enabled()
        return self.page.locator('#plugin-preview')

    def assert_in_canvas(self):
        self.assertTrue(self.page.evaluate('''() => {
          const c = document.querySelector('#canvas').getBoundingClientRect();
          return [...document.querySelectorAll('.paper')].every(p => {
            const r = p.getBoundingClientRect();
            return r.left >= c.left && r.right <= c.right + 1 && r.top >= c.top && r.bottom <= c.bottom + 1;
          });
        }'''))

    def test_01_notes_and_language_preserve_user_text(self):
        expect(self.page.locator('.paper')).to_have_count(2)
        note = self.page.locator('.paper textarea').first
        note.fill('My own thought — 不要丢失')
        self.page.locator('#language').click()
        expect(self.page.locator('html')).to_have_attribute('lang', 'zh-CN')
        expect(self.page.locator('#build')).to_contain_text('一键生成插件')
        expect(note).to_have_value('My own thought — 不要丢失')
        self.page.locator('#language').click()
        expect(note).to_have_value('My own thought — 不要丢失')

    def test_02_timer_counts_pauses_resets_and_survives_translation(self):
        preview = self.build(prompt='Make a 1-minute focus timer')
        expect(preview.locator('.timer-digits')).to_have_text('01:00')
        preview.get_by_role('button', name='Start', exact=True).click()
        expect(preview.locator('.timer-digits')).to_have_text('00:59', timeout=2500)
        self.page.locator('#language').click()
        preview.get_by_role('button', name='暂停', exact=True).click()
        paused = preview.locator('.timer-digits').inner_text()
        self.page.wait_for_timeout(1100)
        expect(preview.locator('.timer-digits')).to_have_text(paused)
        preview.get_by_role('button', name='重置', exact=True).click()
        expect(preview.locator('.timer-digits')).to_have_text('01:00')

    def test_03_habits_and_checklist_are_distinct_working_tools(self):
        preview = self.build('habits')
        expect(preview.locator('input[type=checkbox]')).to_have_count(3)
        expect(preview.locator('.widget-add')).to_have_count(0)
        preview.locator('input[type=checkbox]').first.check()
        expect(preview.locator('.widget-summary')).to_contain_text('1 / 3 complete')
        self.page.locator('#language').click()
        expect(preview.locator('input[type=checkbox]').first).to_be_checked()
        preview.locator('.widget-summary button').click()
        expect(preview.locator('.widget-summary')).to_contain_text('0 / 3')
        preview = self.build('checklist')
        preview.locator('.widget-input').fill('新任务 <b>不是 HTML</b>')
        preview.locator('.widget-add button').click()
        expect(preview.locator('input[type=checkbox]')).to_have_count(4)
        expect(preview.locator('.widget-list b')).to_have_count(0)
        expect(preview.locator('.widget-list')).to_contain_text('新任务 <b>不是 HTML</b>')

    def test_04_add_to_canvas_fold_keyboard_drag_and_bounds(self):
        self.build('focus')
        self.page.locator('#install').click()
        expect(self.page.locator('.paper')).to_have_count(3)
        expect(self.page.locator('#install')).to_be_disabled()
        paper = self.page.locator('.paper').last
        handle = paper.locator('.drag-handle')
        handle.focus()
        x = paper.evaluate('(p) => p.offsetLeft')
        handle.press('ArrowLeft')
        self.assertLess(paper.evaluate('(p) => p.offsetLeft'), x)
        box = handle.bounding_box()
        self.page.mouse.move(box['x'] + 15, box['y'] + 12)
        self.page.mouse.down()
        self.page.mouse.move(1800, 1400, steps=6)
        self.page.mouse.up()
        self.assert_in_canvas()
        paper.locator('.paper-action').first.click()
        expect(paper).to_have_class('paper is-new is-folded')
        self.page.locator('#fold-all').click()
        expect(self.page.locator('.paper.is-folded')).to_have_count(3)
        self.page.locator('#fold-all').click()
        expect(self.page.locator('.paper.is-folded')).to_have_count(0)
        self.assert_in_canvas()

    def test_05_cancel_and_rebuild_do_not_resurrect_stale_results(self):
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.locator('#build').click()
        self.page.locator('#cancel-build').click()
        self.page.wait_for_timeout(1700)
        expect(self.page.locator('#plugin-preview')).to_be_hidden()
        expect(self.page.locator('#install')).to_be_disabled()
        self.page.locator('#build').click()
        self.page.locator('[data-recipe=habits]').click()
        self.page.locator('#build').click()
        expect(self.page.locator('#install')).to_be_enabled()
        expect(self.page.locator('#plugin-preview .timer-digits')).to_have_count(0)
        expect(self.page.locator('#plugin-preview input[type=checkbox]')).to_have_count(3)
        self.page.wait_for_timeout(1700)
        expect(self.page.locator('#plugin-preview .timer-digits')).to_have_count(0)

    def test_06_prompt_validation_keyboard_shortcut_and_custom_items(self):
        self.page.locator('#prompt').fill('Make a weather radar')
        self.page.locator('#build').click()
        expect(self.page.locator('#prompt-error')).to_contain_text('supports focus timers')
        expect(self.page.locator('#prompt')).to_have_attribute('aria-invalid', 'true')
        expect(self.page.locator('#install')).to_be_disabled()
        self.page.locator('#prompt').fill('Make a checklist: Design, Build, Test')
        self.page.locator('#prompt').press('Control+Enter')
        expect(self.page.locator('#install')).to_be_enabled()
        expect(self.page.locator('#plugin-preview .widget-list')).to_contain_text('Design')
        expect(self.page.locator('#plugin-preview .widget-list')).to_contain_text('Test')

    def test_07_source_and_download_are_same_runnable_safe_html(self):
        self.build('checklist', 'checklist: </script><script>window.__xss=1</script>, A real task')
        self.page.locator('#source-tab').click()
        source = self.page.locator('#source-code').inner_text()
        self.assertIn('\\u003c/script\\u003e', source)
        with self.page.expect_download() as downloaded:
            self.page.locator('#download-demo').click()
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / downloaded.value.suggested_filename
            downloaded.value.save_as(target)
            self.assertEqual(target.read_text(), source)
            exported = self.context.new_page()
            exported.set_content(source)
            expect(exported.locator('.widget-list input')).to_have_count(2)
            exported.locator('.widget-list input').first.check()
            expect(exported.locator('.widget-summary')).to_contain_text('1 / 2 complete')
            self.assertIsNone(exported.evaluate('window.__xss'))
            expect(exported.locator('img')).to_have_count(0)
            exported.close()

    def test_08_canvas_cap_remove_and_color(self):
        for _ in range(7):
            self.page.locator('#add-note').click()
        expect(self.page.locator('.paper')).to_have_count(7)
        expect(self.page.locator('#toast')).to_contain_text('limit')
        self.page.locator('.paper').last.locator('.paper-action').last.click()
        expect(self.page.locator('.paper')).to_have_count(6)
        self.page.locator('#add-note').click()
        expect(self.page.locator('.paper')).to_have_count(7)
        self.page.locator('.palette [data-palette=lavender]').click()
        expect(self.page.locator('#canvas')).to_have_attribute('data-palette', 'lavender')
        self.page.locator('#tidy').click()
        self.assert_in_canvas()

    def test_09_layout_and_reduced_motion_in_both_languages(self):
        for language in ['en', 'zh-CN']:
            if language == 'zh-CN':
                self.page.locator('#language').click()
            for width in [320, 390, 768, 1024, 1440, 1920]:
                with self.subTest(language=language, width=width):
                    self.page.set_viewport_size({'width': width, 'height': 900})
                    self.page.wait_for_timeout(80)
                    self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow')
                    self.assert_in_canvas()
        self.assertEqual(self.page.locator('.paper').first.evaluate('(p) => getComputedStyle(p).animationName'), 'none')

    def test_10_generated_tools_are_independent_and_language_change_cancels(self):
        preview = self.build('habits')
        preview.locator('input[type=checkbox]').first.check()
        self.page.locator('#install').click()
        expect(self.page.locator('.paper').last.locator('input[type=checkbox]').first).not_to_be_checked()
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.locator('#build').click()
        self.page.locator('#language').click()
        self.page.wait_for_timeout(1700)
        expect(self.page.locator('#plugin-preview')).to_be_hidden()
        expect(self.page.locator('#install')).to_be_disabled()
        expect(self.page.locator('.paper').last.locator('.widget h3')).to_have_text('每天，一点小进步。')

if __name__ == '__main__':
    unittest.main(verbosity=2)
