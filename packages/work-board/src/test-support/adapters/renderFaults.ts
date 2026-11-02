import * as shiki from "shiki";
import { afterEach, vi } from "vitest";

vi.mock("shiki", async (importOriginal) => {
	const actual = await importOriginal<typeof import("shiki")>();
	return { ...actual, createHighlighter: vi.fn(actual.createHighlighter) };
});
afterEach(() => vi.restoreAllMocks());

export function themeLoadingFails(cause: unknown) {
	vi.mocked(shiki.createHighlighter).mockRejectedValueOnce(cause);
}

export function observeRenderers(failCode?: unknown) {
	const disposed: shiki.Highlighter[] = [];
	vi.mocked(shiki.createHighlighter).mockImplementation(async (options) => {
		const actual = await vi.importActual<typeof shiki>("shiki");
		const highlighter = await actual.createHighlighter(options);
		const dispose = highlighter.dispose.bind(highlighter);
		vi.spyOn(highlighter, "dispose").mockImplementation(() => {
			dispose();
			disposed.push(highlighter);
		});
		if (failCode !== undefined) {
			vi.spyOn(highlighter, "loadLanguage").mockRejectedValue(failCode);
		}
		return highlighter;
	});
	return () => disposed.map(() => "Markdown highlighter");
}

export function refuseRenderers() {
	vi.mocked(shiki.createHighlighter).mockRejectedValue(new Error("Server rendering is unavailable"));
	return () => vi.mocked(shiki.createHighlighter).mock.calls.length;
}
