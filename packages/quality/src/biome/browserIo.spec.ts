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
