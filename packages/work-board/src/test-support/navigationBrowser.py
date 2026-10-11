import subprocess
import sys
import unittest
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


class NavigationBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/navigation-evidence")
        cls.output.mkdir(parents=True, exist_ok=True)
        cls.server = subprocess.Popen(
            ["node", "--conditions=source", str(Path(__file__).with_name("navigationServer.ts"))],
            stdout=subprocess.PIPE, text=True,
        )
        cls.addClassCleanup(cls.stop_server)
        for line in cls.server.stdout:
            if line.startswith("http://"):
                cls.url = line.strip()
                break
        else:
            raise RuntimeError("The fixture server did not start")
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(chromium_sandbox=True)
        print(f"Chromium {cls.browser.version}")

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    @classmethod
    def stop_server(cls):
        cls.server.terminate()
        cls.server.wait(timeout=15)
        cls.server.stdout.close()

    def check_width(self, width, height):
        context = self.browser.new_context(viewport={"width": width, "height": height})
        self.addCleanup(context.close)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(self.url + "/notes/topic-1.md")
        expect(page.locator("#live")).to_have_text("live")
        drawer = page.locator("#sidebar")
        opener = page.locator("#sidebar-toggle")

        def open_drawer():
            if width < 768 and not drawer.is_visible():
                opener.click()
                expect(drawer).to_be_visible()

        def current_visible():
            page.wait_for_function("""() => {
                const tree = document.getElementById('files').getBoundingClientRect();
                const row = document.querySelector('#files a[aria-current="page"]').getBoundingClientRect();
                return row.top >= tree.top - 1 && row.bottom <= tree.bottom + 1;
            }""")

        if width < 768:
            expect(drawer).to_be_hidden()
            for dismissal in ("escape", "outside"):
                open_drawer()
                expect(drawer).to_have_attribute("aria-modal", "true")
                self.assertTrue(page.locator(".page").evaluate("el => el.inert"))
                page.keyboard.press("Shift+Tab")
                self.assertTrue(drawer.evaluate("el => el.contains(document.activeElement)"))
                page.keyboard.press("Tab")
                self.assertTrue(drawer.evaluate("el => el.contains(document.activeElement)"))
                if dismissal == "escape":
                    page.keyboard.press("Escape")
                else:
                    page.mouse.click(width - 8, height // 2)
                expect(drawer).to_be_hidden()
                expect(opener).to_be_focused()
                self.assertFalse(page.locator(".page").evaluate("el => el.inert"))
        open_drawer()
        positions = lambda: page.locator("#primary-navigation a").evaluate_all(
            "rows => rows.map(row => row.getBoundingClientRect().y)"
        )
        original = positions()
        self.assertEqual(page.locator("#primary-navigation a").count(), 6)
        tree = page.locator("#files")
        tree_top = tree.bounding_box()["y"]
        window_scroll = page.evaluate("scrollY")
        tree.evaluate("el => el.scrollTop = el.scrollHeight")
        self.assertGreater(tree.evaluate("el => el.scrollTop"), 0)
        self.assertEqual(positions(), original)
        self.assertEqual(page.evaluate("scrollY"), window_scroll)
        self.assertEqual(drawer.evaluate("el => el.scrollTop"), 0)
        for index in (10, 20, 30, 40, 48):
            tree.locator(f'a[href="/notes/topic-{index}.md"]').click()
            expect(page.locator("#doc")).to_have_attribute("data-file", f"notes/topic-{index}.md")
            open_drawer()
            current = tree.locator('a[aria-current="page"]')
            expect(current).to_have_attribute("href", f"/notes/topic-{index}.md")
            current_visible()
            self.assertEqual(positions(), original)
            self.assertEqual(tree.bounding_box()["y"], tree_top)
            expect(page.locator("#library-dialog")).not_to_be_visible()
        page.go_back()
        expect(page.locator("#doc")).to_have_attribute("data-file", "notes/topic-40.md")
        open_drawer()
        current_visible()
        for index in range(2, 8):
            tree.locator(f'a[href="/notes/topic-{index}.md"]').click()
            expect(page.locator("#doc")).to_have_attribute("data-file", f"notes/topic-{index}.md")
            open_drawer()
        page.locator("#library-open").click()
        panel = page.locator("#library-dialog")
        expect(panel).to_be_visible()
        self.assertEqual(panel.locator("a").count(), 10)
        self.assertLessEqual(panel.bounding_box()["height"], min(600, height - 32))
        self.assertEqual(positions(), original)
        page.keyboard.press("Escape")
        expect(panel).not_to_be_visible()
        expect(page.locator("#library-open")).to_be_focused()
        self.assertLessEqual(page.evaluate("document.documentElement.scrollWidth"), width)
        label = "desktop" if width == 1440 else "narrow"
        page.screenshot(path=str(self.output / f"navigation-{label}.png"))
        page.locator("#library-open").click()
        page.screenshot(path=str(self.output / f"navigation-recents-{label}.png"))
        page.locator("#library-close").click()
        if width < 768:
            page.keyboard.press("Escape")
            page.screenshot(path=str(self.output / "navigation-narrow-closed.png"))
            page.set_viewport_size({"width": 768, "height": height})
            expect(drawer).to_be_visible()
            page.set_viewport_size({"width": 767, "height": height})
            expect(drawer).to_be_hidden()
        else:
            opener.click()
            page.reload()
            expect(page.locator("#live")).to_have_text("live")
            expect(drawer).to_be_hidden()
            opener.click()
            current_visible()
        self.assertEqual(errors, [])

    def test_desktop(self):
        self.check_width(1440, 1000)

    def test_narrow(self):
        self.check_width(390, 844)


if __name__ == "__main__":
    unittest.main(argv=[sys.argv[0]], verbosity=2)
