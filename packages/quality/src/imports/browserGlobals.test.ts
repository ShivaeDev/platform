import { describe, expect, it } from "vitest";
import { browserGlobals } from "./browserGlobals.ts";

function subjects(text: string): readonly string[] {
	return browserGlobals({ lines: text.split("\n"), path: "src/value.ts", text }).map((finding) => finding.subject ?? "");
}

describe("shared browser globals", () => {
	it.each([
		"window",
		"document",
		"localStorage",
		"sessionStorage",
		"navigator",
		"location",
		"HTMLElement",
		"MutationObserver",
		"history",
		"self",
		"indexedDB",
		"caches",
		"XMLHttpRequest",
		"requestAnimationFrame",
	])("finds direct uses of %s", (name) => expect(subjects(`export const value = ${name};`)).toEqual([name]));

	it("finds qualified and shorthand uses", () => {
		expect(subjects('export const values = [globalThis.window, globalThis["document"], { localStorage }];')).toEqual([
			"window",
			"document",
			"localStorage",
		]);
	});

	it("checks destructured globals without confusing object binding keys for globals", () => {
		expect(subjects("const { document: view, localStorage } = globalThis;")).toEqual(["document", "localStorage"]);
		expect(subjects("const { document: view, localStorage } = options;")).toEqual([]);
	});

	it("respects local bindings, parameters, imports and their lexical scope", () => {
		expect(
			subjects(
				'import { document } from "dom-adapter";\nconst window = {};\nfunction read(localStorage: unknown) { return { localStorage }; }\nexport const value = [window, document, read(1)];',
			),
		).toEqual([]);
		expect(subjects("function read(window: unknown) { return window; }\nexport const value = window;")).toEqual(["window"]);
		expect(subjects("function read(globalThis: { window: unknown }) { return globalThis.window; }")).toEqual([]);
	});

	it("ignores property names, strings, comments, types and portable web APIs", () => {
		expect(
			subjects(
				'const object = { window: 1, document: 2 };\nexport const value = [object.window, object.document, "window", URL, fetch, AbortController];\ntype View = Window;\n// document',
			),
		).toEqual([]);
	});

	it("does not treat loop labels or their jump targets as global values", () => {
		expect(subjects("window: for (let n = 0; n < 2; n++) { if (n === 1) break window; continue window; }")).toEqual([]);
	});
});
