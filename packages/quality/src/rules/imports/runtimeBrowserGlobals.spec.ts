import { expect } from "vitest";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { emptyFolders, importStory, repositoryHas } from "#test/importStory.ts";

const DIRECT = [
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
];

const REPORTED: ReadonlyArray<readonly [string, string, readonly string[]]> = [
	[
		"globalThis members and an object shorthand",
		'export const values = [globalThis.window, globalThis["document"], { localStorage }];',
		["window", "document", "localStorage"],
	],
	["a declaration that destructures globalThis", "const { document: view, localStorage } = globalThis;", ["document", "localStorage"]],
	["a parameter default", "function title({ document } = globalThis) { return document.title; }", ["document"]],
	["an arrow parameter default", "const title = ({ document } = globalThis) => document.title;", ["document"]],
	["a quoted parameter key", 'function title({ "document": view } = globalThis) { return view.title; }', ["document"]],
	["an assignment", "let document; ({ document } = globalThis);", ["document"]],
	["a renaming assignment", "let view; ({ document: view } = globalThis);", ["document"]],
	["a quoted assignment key", 'let view; ({ "document": view } = globalThis);', ["document"]],
	["a nested assignment pattern", "let title; ({ document: { title } } = globalThis);", ["document"]],
	["a computed parameter key", 'function title({ ["document"]: view } = globalThis) { return view.title; }', ["document"]],
	["a computed assignment key", 'let view; ({ ["document"]: view } = globalThis);', ["document"]],
	["a parenthesized parameter default", "function title({ document } = (globalThis)) { return document.title; }", ["document"]],
	["a parenthesized assignment source", "let document; ({ document } = (globalThis));", ["document"]],
	["an asserted assignment source", "let document; ({ document } = globalThis as typeof globalThis);", ["document"]],
	["an object destructuring default", "const { value = window } = options;", ["window"]],
	["a renamed destructuring default", "const { document: value = window } = options;", ["window"]],
	["an array destructuring default", "const [value = window] = options;", ["window"]],
	["an object parameter default", "function read({ value = window }) { return value; }", ["window"]],
	["an array parameter default", "function read([value = window]) { return value; }", ["window"]],
	["a superclass", "export class View extends HTMLElement {}", ["HTMLElement"]],
	["a window member superclass", "export class View extends window.HTMLElement {}", ["window"]],
	["a globalThis member superclass of a class expression", "export const View = class extends globalThis.HTMLElement {};", ["HTMLElement"]],
	["a superclass factory argument", "export class View extends factory(document) {}", ["document"]],
	[
		"a module-level read beside a parameter that shadows it",
		"function read(window: unknown) { return window; }\nexport const value = window;",
		["window"],
	],
];

const IGNORED: ReadonlyArray<readonly [string, string]> = [
	["a declaration that destructures another object", "const { document: view, localStorage } = options;"],
	["a parameter named globalThis", "function title(globalThis: unknown, { document } = globalThis) { return document.title; }"],
	["a module-level globalThis binding", "export const globalThis = options; let document; ({ document } = globalThis);"],
	["a block-scoped globalThis binding", "{ const globalThis = options; let document; ({ document } = globalThis); }"],
	["a parenthesized parameter named globalThis", "function title(globalThis: unknown, { document } = (globalThis)) { return document.title; }"],
	[
		"destructuring keys of another object",
		"function title({ document } = options) { return document.title; } let document; ({ document } = options);",
	],
	[
		"portable globals and rest bindings",
		"function read({ URL, ...document } = globalThis) { return [URL, document]; } let URL, document; ({ URL, ...document } = globalThis);",
	],
	["a computed key held in a local constant", 'const document = "URL"; let value; ({ [document]: value } = globalThis);'],
	["a destructuring default bound locally", "const window = {}; const { document: value = window } = options;"],
	["a destructuring default bound by a parameter", "function read(window: unknown, { value = window }) { return value; }"],
	[
		"type arguments and implements clauses",
		"export class View extends Base<Window> implements HTMLElement {} interface BrowserView extends HTMLElement {}",
	],
	[
		"member implements clauses and interface heritage",
		"export class View implements window.HTMLElement {} interface BrowserView extends window.HTMLElement {}",
	],
	["a superclass bound locally", "const HTMLElement = Base; export class View extends HTMLElement {}"],
	[
		"local bindings, parameters and imports",
		'import { document } from "dom-adapter";\nconst window = {};\nfunction read(localStorage: unknown) { return { localStorage }; }\nexport const value = [window, document, read(1)];',
	],
	["a globalThis parameter's members", "function read(globalThis: { window: unknown }) { return globalThis.window; }"],
	[
		"property names, strings, comments, types and portable web APIs",
		'const object = { window: 1, document: 2 };\nexport const value = [object.window, object.document, "window", URL, fetch, AbortController];\ntype View = Window;\n// document',
	],
	["loop labels and their jump targets", "window: for (let n = 0; n < 2; n++) { if (n === 1) break window; continue window; }"],
];

for (const name of DIRECT) {
	importStory.it(
		`imports/runtime reports shared code that reads the browser global ${name}`,
		[emptyFolders("src/server"), repositoryHas({ content: `export const value = ${name};`, path: "src/value.ts" })],
		function* ({ check, subjects }) {
			yield* check(importsRuntime);

			expect(yield* subjects()).toEqual([name]);
		},
	);
}

for (const [form, content, globals] of REPORTED) {
	importStory.it(
		`imports/runtime reports the browser globals ${globals.join(", ")} that shared code reads through ${form}`,
		[emptyFolders("src/server"), repositoryHas({ content, path: "src/value.ts" })],
		function* ({ check, subjects }) {
			yield* check(importsRuntime);

			expect(yield* subjects()).toEqual(globals);
		},
	);
}

for (const [form, content] of IGNORED) {
	importStory.it(
		`imports/runtime takes no browser global from ${form} in shared code`,
		[emptyFolders("src/server"), repositoryHas({ content, path: "src/value.ts" })],
		function* ({ check }) {
			expect(yield* check(importsRuntime)).toEqual([]);
		},
	);
}
