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

	it.each([
		"function title({ document } = globalThis) { return document.title; }",
		"const title = ({ document } = globalThis) => document.title;",
		'function title({ "document": view } = globalThis) { return view.title; }',
		"let document; ({ document } = globalThis);",
		"let view; ({ document: view } = globalThis);",
		'let view; ({ "document": view } = globalThis);',
		"let title; ({ document: { title } } = globalThis);",
		'function title({ ["document"]: view } = globalThis) { return view.title; }',
		'let view; ({ ["document"]: view } = globalThis);',
		"function title({ document } = (globalThis)) { return document.title; }",
		"let document; ({ document } = (globalThis));",
		"let document; ({ document } = globalThis as typeof globalThis);",
	])("finds globals read by parameter and assignment destructuring: %s", (text) => {
		expect(subjects(text)).toEqual(["document"]);
	});

	it("respects a locally bound globalThis in parameter defaults and assignments", () => {
		expect(subjects("function title(globalThis: unknown, { document } = globalThis) { return document.title; }")).toEqual([]);
		expect(subjects("export const globalThis = options; let document; ({ document } = globalThis);")).toEqual([]);
		expect(subjects("{ const globalThis = options; let document; ({ document } = globalThis); }")).toEqual([]);
		expect(subjects("function title(globalThis: unknown, { document } = (globalThis)) { return document.title; }")).toEqual([]);
	});

	it("does not confuse local destructuring keys, portable globals or rest bindings with browser reads", () => {
		expect(subjects("function title({ document } = options) { return document.title; } let document; ({ document } = options);")).toEqual([]);
		expect(
			subjects(
				"function read({ URL, ...document } = globalThis) { return [URL, document]; } let URL, document; ({ URL, ...document } = globalThis);",
			),
		).toEqual([]);
		expect(subjects('const document = "URL"; let value; ({ [document]: value } = globalThis);')).toEqual([]);
	});

	it.each([
		"const { value = window } = options;",
		"const { document: value = window } = options;",
		"const [value = window] = options;",
		"function read({ value = window }) { return value; }",
		"function read([value = window]) { return value; }",
	])("finds browser globals in runtime destructuring defaults: %s", (text) => {
		expect(subjects(text)).toEqual(["window"]);
	});

	it("respects local bindings in destructuring defaults", () => {
		expect(subjects("const window = {}; const { document: value = window } = options;")).toEqual([]);
		expect(subjects("function read(window: unknown, { value = window }) { return value; }")).toEqual([]);
	});

	it.each([
		["export class View extends HTMLElement {}", "HTMLElement"],
		["export class View extends window.HTMLElement {}", "window"],
		["export const View = class extends globalThis.HTMLElement {};", "HTMLElement"],
		["export class View extends factory(document) {}", "document"],
	])("finds browser-dependent class superclasses: %s", (text, name) => {
		expect(subjects(text)).toEqual([name]);
	});

	it("keeps superclass type arguments, implements clauses and interface heritage outside the runtime scan", () => {
		expect(subjects("export class View extends Base<Window> implements HTMLElement {} interface BrowserView extends HTMLElement {}")).toEqual([]);
		expect(subjects("export class View implements window.HTMLElement {} interface BrowserView extends window.HTMLElement {}")).toEqual([]);
		expect(subjects("const HTMLElement = Base; export class View extends HTMLElement {}")).toEqual([]);
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
