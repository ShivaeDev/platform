import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { bundleNotBuilt } from "#test/servingStoryTraits.ts";

const plan = projectFiles({ "plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n" });

for (const [accept, encoding] of [
	[undefined, "none"],
	["identity", "none"],
	["gzip, deflate, br", "br"],
	["gzip, br;q=0", "gzip"],
	["br;q=0.5, *;q=0", "br"],
] as const) {
	boardStory.it(
		`a browser ${accept === undefined ? "sending no accept-encoding" : `accepting "${accept}"`} receives the script bundle ${encoding === "none" ? "uncompressed" : `as ${encoding}`}, marked as varying with accept-encoding`,
		[plan],
		function* ({ download }) {
			const script = (yield* download("/_board/react.js")).text;

			const delivered = yield* download("/_board/react.js", accept === undefined ? {} : { "accept-encoding": accept });

			expect(delivered).toMatchObject({ encoding, text: script, vary: "accept-encoding" });
		},
	);
}

for (const [content, path] of [
	["the stylesheet", "/_board/react.css"],
	["the page shell", "/"],
	["a document's page", "/plan.md"],
] as const) {
	boardStory.it(`a browser accepting gzip receives ${content} gzip-compressed with its text intact`, [plan], function* ({ download }) {
		const text = (yield* download(path)).text;

		expect(yield* download(path, { "accept-encoding": "gzip" })).toMatchObject({ encoding: "gzip", text });
	});
}

for (const path of ["/_board/rpc", "/_board/rpc/"]) {
	boardStory.it(
		`an RPC answer from ${path} reaches a gzip-accepting client compressed and marked private and unstored`,
		[plan],
		function* ({ queryRpc }) {
			expect(yield* queryRpc(path, { "accept-encoding": "gzip" })).toEqual({
				answer: "answered",
				cacheControl: "private, no-store",
				encoding: "gzip",
			});
		},
	);
}

for (const [bundle, path] of [
	["the script bundle", "/_board/react.js"],
	["the stylesheet", "/_board/react.css"],
	["the theme script", "/_board/theme.js"],
	["Mermaid's entry module", "/_board/mermaid/mermaid.esm.min.mjs"],
] as const) {
	boardStory.it(`${bundle} must be revalidated, and revalidating with its ETag answers Not Modified with no body`, [plan], function* ({ download }) {
		const fresh = yield* download(path);
		expect(fresh).toMatchObject({ cacheControl: "no-cache", etag: expect.stringMatching(/^W\/"[\w.-]+"$/u) });

		const revalidated = yield* download(path, { "if-none-match": fresh.etag ?? "" });

		expect(revalidated).toMatchObject({ etag: fresh.etag, status: "Not Modified", text: "" });
	});
}

for (const [bundle, path] of [
	["the script bundle", "/_board/react.js"],
	["Mermaid's entry module", "/_board/mermaid/mermaid.esm.min.mjs"],
] as const) {
	boardStory.it(`a content-hashed chunk that ${bundle} imports is cached for a year`, [plan], function* ({ download, importedChunk }) {
		const chunk = yield* importedChunk(path);

		expect(yield* download(chunk)).toMatchObject({ cacheControl: "max-age=31536000, immutable", status: "OK" });
	});
}

for (const path of ["/", "/plan.md", "/_board/system"]) {
	boardStory.it(`the page at ${path} is never stored and carries no ETag`, [plan], function* ({ download }) {
		expect(yield* download(path)).toMatchObject({ cacheControl: "no-store", etag: undefined });
	});
}

boardStory.it(
	"a browser revalidating the script bundle with the previous build's ETag receives the rebuilt bundle",
	[plan, bundleNotBuilt("react.js")],
	function* ({ buildBundle, download }) {
		const firstBuild = buildBundle("react.js", "first");
		const first = yield* download("/_board/react.js", { "accept-encoding": "br" });
		expect(first.text).toBe(firstBuild);

		const secondBuild = buildBundle("react.js", "second");

		expect(yield* download("/_board/react.js", { "accept-encoding": "br", "if-none-match": first.etag ?? "" })).toMatchObject({
			status: "OK",
			text: secondBuild,
		});
	},
);

for (const path of ["/", "/plan.md", "/_board/goals"]) {
	boardStory.it(
		`the first HTML of ${path} links the stylesheet in its head and outlines the sidebar, header and navigation before any script runs`,
		[plan],
		function* ({ pageShell }) {
			expect(yield* pageShell(path)).toMatchObject({ skeleton: ["aside", "header", "nav"], stylesheets: ["/_board/react.css"] });
		},
	);
}
