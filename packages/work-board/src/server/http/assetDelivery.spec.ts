import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

const plan = projectFiles({ "plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n" });
const OK = 200;
const NOT_MODIFIED = 304;
const START = `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "work-board.start" })}\n`;

boardStory.it("compresses scripts, styles, the page shell and RPC answers for a client that accepts it", [plan], function* ({ exchange }) {
	for (const path of ["/_board/react.js", "/_board/react.css", "/", "/plan.md"]) {
		const plain = yield* exchange(path);
		expect(plain.headers["content-encoding"]).toBeUndefined();
		expect(plain.headers.vary).toBe("accept-encoding");
		for (const [accept, encoding] of [
			["gzip, deflate, br", "br"],
			["gzip, br;q=0", "gzip"],
			["br;q=0.5, *;q=0", "br"],
		] as const) {
			const compressed = yield* exchange(path, { "accept-encoding": accept });
			expect(compressed.status).toBe(OK);
			expect(compressed.headers["content-encoding"]).toBe(encoding);
			expect(compressed.headers.vary).toBe("accept-encoding");
			expect(compressed.text).toBe(plain.text);
			expect(compressed.body.length).toBeLessThan(plain.body.length);
		}
		expect((yield* exchange(path, { "accept-encoding": "identity" })).headers["content-encoding"]).toBeUndefined();
	}
	for (const path of ["/_board/rpc", "/_board/rpc/"]) {
		const rpc = yield* exchange(path, { "accept-encoding": "gzip", "content-type": "application/ndjson" }, "POST", START);
		expect(rpc.headers["content-encoding"]).toBe("gzip");
		expect(rpc.headers["cache-control"]).toBe("no-store");
		expect(rpc.text).toContain('"_tag":"Success"');
		expect(rpc.body.length).toBeLessThan(rpc.text.length / 2);
	}
});

boardStory.it("caches content-hashed chunks for a year while the shell and fixed-name bundles revalidate", [plan], function* ({ exchange }) {
	const entry = yield* exchange("/_board/react.js");
	const chunk = /react-assets\/(?<name>[\w-]+\.js)/u.exec(entry.text)?.groups?.name;
	expect(chunk).toBeDefined();
	const hashed = yield* exchange(`/_board/react-assets/${chunk}`);
	expect(hashed.status).toBe(OK);
	expect(hashed.headers["cache-control"]).toBe("max-age=31536000, immutable");
	const mermaid = yield* exchange("/_board/mermaid/mermaid.esm.min.mjs");
	expect(mermaid.headers["cache-control"]).toBe("no-cache");
	const mermaidChunk = /chunks\/mermaid\.esm\.min\/[\w-]+\.mjs/u.exec(mermaid.text)?.[0];
	expect(mermaidChunk).toBeDefined();
	expect((yield* exchange(`/_board/mermaid/${mermaidChunk}`)).headers["cache-control"]).toBe("max-age=31536000, immutable");
	for (const path of ["/_board/react.js", "/_board/react.css", "/_board/theme.js"]) {
		const fresh = yield* exchange(path);
		expect(fresh.headers["cache-control"]).toBe("no-cache");
		expect(fresh.headers.etag).toMatch(/^W\/"[\w-]+"$/u);
		const revalidated = yield* exchange(path, { "if-none-match": fresh.headers.etag ?? "" });
		expect(revalidated.status).toBe(NOT_MODIFIED);
		expect(revalidated.text).toBe("");
		expect(revalidated.headers.etag).toBe(fresh.headers.etag);
	}
	for (const path of ["/", "/plan.md", "/_board/system"]) {
		const page = yield* exchange(path);
		expect(page.headers["cache-control"]).toBe("no-store");
		expect(page.headers.etag).toBeUndefined();
	}
});

boardStory.it(
	"gives a rebuilt bundle a new ETag so a revalidating browser never keeps the old build",
	[plan, deferredServing],
	function* ({ startWithMissingAssets, editFile, exchange }) {
		const board = yield* startWithMissingAssets(["react.js"]);
		try {
			editFile("react.js", `export const build = "${"first".repeat(400)}";`);
			const first = yield* exchange("/_board/react.js", { "accept-encoding": "br" });
			expect(first.headers["content-encoding"]).toBe("br");
			editFile("react.js", `export const build = "${"second".repeat(400)}";`);
			const rebuilt = yield* exchange("/_board/react.js", { "accept-encoding": "br", "if-none-match": first.headers.etag ?? "" });
			expect(rebuilt.status).toBe(OK);
			expect(rebuilt.headers.etag).not.toBe(first.headers.etag);
			expect(rebuilt.text).toContain("secondsecond");
			expect(rebuilt.text).not.toContain("first");
			expect((yield* exchange("/_board/react.js", { "accept-encoding": "br", "if-none-match": rebuilt.headers.etag ?? "" })).status).toBe(
				NOT_MODIFIED,
			);
		} finally {
			yield* board.stop();
		}
	},
);

boardStory.it(
	"outlines the header and sidebar in theme colours from the first HTML and stylesheet before any script runs",
	[plan],
	function* ({ exchange }) {
		for (const path of ["/", "/plan.md", "/_board/goals"]) {
			const html = (yield* exchange(path)).text;
			expect(html.slice(html.indexOf("<body>"))).toBe(
				'<body><div data-board-react-root><div aria-hidden="true" data-board-skeleton><aside></aside><div><header></header></div><nav></nav></div></div></body></html>',
			);
			expect(html.indexOf('<link rel="stylesheet" href="/_board/react.css">')).toBeLessThan(html.indexOf("</head>"));
		}
		const styles = (yield* exchange("/_board/react.css")).text;
		const skeleton = styles.slice(styles.indexOf("[data-board-skeleton]"));
		for (const token of ["var(--background)", "var(--card)", "var(--border)"]) {
			expect(skeleton).toContain(token);
		}
		expect(styles).toMatch(/\.dark\s*\{[^}]*--background:/u);
	},
);
