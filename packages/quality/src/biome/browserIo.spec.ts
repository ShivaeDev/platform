import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";
import { assertThat } from "#testing/assertThat.ts";

const GLOBALS = ["fetch", "localStorage", "sessionStorage", "indexedDB", "WebSocket", "EventSource", "Worker", "SharedWorker"];

const READS = GLOBALS.flatMap((name) => [name, `globalThis.${name}`, `window.${name}`, `self.${name}`]);

const CONTENT = `${READS.map((read) => `void ${read};`).join("\n")}\n`;

biomeStory.it(
	"ambient-runtime reports each browser I/O global, bare or through globalThis, window or self, in shared, server and entry code and accepts it in adapters/, test-support/ and tests",
	[
		presetInstalled(),
		repositoryHas(
			...["src/shared.ts", "src/server/io.ts", "src/client/main.tsx", "src/client/adapters/io.ts", "src/test-support/io.ts", "src/io.test.ts"].map(
				(path) => ({ content: CONTENT, path }),
			),
		),
	],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported("plugin"), (actual) =>
			actual.toEqual(["src/client/main.tsx", "src/server/io.ts", "src/shared.ts"].flatMap((path) => READS.map((_, index) => `${path}:${index + 1}`))),
		);
	},
);

biomeStory.it(
	"ambient-runtime reports a localStorage read in client code and accepts DOM access there, a parameter named fetch and a fetch property",
	[
		presetInstalled(),
		repositoryHas(
			{ content: 'export const draft = localStorage.getItem("draft");\n', path: "src/client/draft.ts" },
			{
				content:
					'export function mount(root: HTMLElement) {\n\tdocument.title = "Notes";\n\twindow.addEventListener("resize", () => root.focus());\n\tnew ResizeObserver(() => root.focus()).observe(root);\n\treturn document.querySelector("main");\n}\n',
				path: "src/client/mount.ts",
			},
			{ content: 'export function load(fetch: typeof globalThis.fetch) {\n\treturn fetch("/notes");\n}\n', path: "src/client/load.ts" },
			{
				content:
					"export function transport(target: { readonly fetch: typeof globalThis.fetch } = window) {\n\treturn target.fetch.bind(target);\n}\n",
				path: "src/server/transport.ts",
			},
		),
	],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported("plugin"), (actual) => actual.toEqual(["src/client/draft.ts:1"]));
	},
);

const REACHES = [
	["a call", 'void fetch("/notes");'],
	["a constructor", 'void new WebSocket("/live");'],
	["an assignment", "let store: unknown; store = localStorage;"],
	["an argument", "void String(indexedDB);"],
	["a property value", "export const transport = { send: fetch };"],
	["a default parameter", "export function load(send = fetch) { return send; }"],
	["a JSX expression", "export const Save = () => <Form send={fetch} />;"],
	["an optional call", 'void fetch?.("/notes");'],
	["typeof as an expression", "void (typeof Worker);"],
	["a shorthand property", "export const io = { fetch };"],
	["a re-export", "export { EventSource };"],
	["an aliased re-export", "export { SharedWorker as Shared };"],
	["computed access on globalThis", 'void globalThis["fetch"];'],
	["computed access on window", "void window['localStorage'];"],
	["optional computed access on self", 'void self?.["indexedDB"];'],
	["optional member access on globalThis", "void globalThis?.fetch;"],
	["destructuring from globalThis", "const { fetch: send } = globalThis;"],
	["destructuring from window", "const { sessionStorage } = window;"],
	["destructuring from self after another key", "const { name, WebSocket: Socket } = self;"],
] as const;

biomeStory.it(
	`ambient-runtime reports a browser I/O global reached through ${REACHES.map(([reach]) => reach).join(", ")}`,
	[presetInstalled(), repositoryHas({ content: `${REACHES.map(([, line]) => line).join("\n")}\n`, path: "src/client/reach.tsx" })],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported("plugin"), (actual) => actual.toEqual(REACHES.map((_, index) => `src/client/reach.tsx:${index + 1}`)));
	},
);

const BOUND = [
	["a shorthand property", "const fetch = () => undefined;\nexport const io = { fetch };\n"],
	["a re-export", "class WebSocket {}\nexport { WebSocket };\n"],
	["an aliased re-export", "function Worker() {}\nexport { Worker as Thread };\n"],
	["computed access", 'export const read = (window: Storage) => window["localStorage"];\n'],
	["optional member access", "export const send = (self: { readonly fetch?: () => void }) => self?.fetch;\n"],
	["destructuring", "export function open(globalThis: { readonly fetch: () => void }) {\n\tconst { fetch } = globalThis;\n\treturn fetch;\n}\n"],
] as const;

biomeStory.it(
	`ambient-runtime accepts a name the file binds itself in ${BOUND.map(([form]) => form).join(", ")}, and other keys of a global`,
	[
		presetInstalled(),
		repositoryHas(...BOUND.map(([, content], index) => ({ content, path: `src/client/bound${index + 1}.ts` })), {
			content: 'void window["document"];\nconst { document } = window;\nconst { location: { fetch } } = window;\nvoid [document, fetch];\n',
			path: "src/client/dom.ts",
		}),
	],
	function* ({ checks, reported }) {
		yield* checks();

		yield* assertThat(yield* reported("plugin"), (actual) => actual.toEqual([]));
	},
);
