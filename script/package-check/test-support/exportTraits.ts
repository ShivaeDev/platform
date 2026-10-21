import { dirname, join } from "node:path";
import { FileSystem } from "effect";
import { writeJson } from "#package-check/io.ts";
import type { Manifest } from "#package-check/model.ts";
import { archives } from "./archives.ts";

function exportTraits(line: string, manifest: Manifest, files: Readonly<Record<string, string>>) {
	return archives.trait("workspace", line, function* ({ root }) {
		const fs = yield* FileSystem.FileSystem;
		const directory = join(root, "packages/board");
		yield* fs.makeDirectory(directory);
		yield* writeJson(join(directory, "package.json"), { ...manifest, type: "module" });
		for (const [path, source] of Object.entries(files)) {
			yield* fs.makeDirectory(dirname(join(directory, path)), { recursive: true });
			yield* fs.writeFileString(join(directory, path), source);
		}
	});
}

export const executableExport = exportTraits(
	"a mapped executable shares an export pattern with the library",
	{
		bin: { board: "./dist/server/cli.js" },
		exports: {
			"./*.ts": { import: "./dist/server/*.js", source: "./src/server/*.ts" },
			"./board.ts": { import: "./dist/server/board.js", source: "./src/server/board.ts" },
			"./cli.ts": { import: "./dist/server/cli.js", source: "./src/server/cli.ts" },
		},
		name: "board",
		version: "1.0.0",
	},
	{
		"dist/server/board.js": "export {};",
		"dist/server/cli.js": "process.exit(1);",
		"src/server/board.ts": "export {};",
		"src/server/cli.ts": "export {};",
	},
);

export const sharedExport = exportTraits(
	"an exact shared export sits beneath a blocked folder pattern",
	{
		exports: {
			"./*.ts": { import: "./dist/*.js", source: "./src/*.ts" },
			"./browser/responses/*": null,
			"./browser/responses/schema.ts": { import: "./dist/browser/responses/schema.js", source: "./src/browser/responses/schema.ts" },
		},
		name: "board",
		version: "1.0.0",
	},
	{
		"dist/browser/responses/form.js": "export {};",
		"dist/browser/responses/schema.js": "export {};",
		"src/browser/responses/form.ts": "export {};",
		"src/browser/responses/schema.ts": "export {};",
	},
);

export const aliasedExport = exportTraits(
	"an exact blocked module has a public alias",
	{
		exports: { "./loadQuery.ts": null, "./router.ts": { import: "./dist/loadQuery.js", source: "./src/loadQuery.ts" } },
		name: "router",
		version: "1.0.0",
	},
	{ "dist/loadQuery.js": "export {};", "src/loadQuery.ts": "export {};" },
);

export const selectedPattern = exportTraits(
	"specific export patterns select modules ahead of the root wildcard",
	{
		exports: {
			"./*.ts": { import: "./dist/*.js", source: "./src/*.ts" },
			"./browser/document/*.ts": { import: "./dist/client/document/*.js", source: "./src/client/document/*.ts" },
			"./rpc/*.ts": { import: "./dist/server/rpc/*.js", source: "./src/server/rpc/*.ts" },
			"./server/*": null,
		},
		name: "board",
		version: "1.0.0",
	},
	{
		"dist/server/rpc/present.js": "export {};",
		"src/browser/document/sourceGroups.ts": "export {};",
		"src/rpc/PageUrl.ts": "export {};",
		"src/rpc/present.ts": "export {};",
		"src/server/rpc/present.ts": "export {};",
	},
);

export const unrelatedBrowserClient = exportTraits(
	"the packed Board executable serves unrelated JavaScript as its browser client",
	{ bin: { board: "./server.js" }, name: "board", version: "1.0.0" },
	{
		"server.js": `import { createServer } from "node:http";
const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/javascript" });
  response.end(request.url === "/_board/react.js" ? "const unrelated = true; export { unrelated as session };" : "work-board");
});
server.listen(0, "127.0.0.1", () => console.log("http://127.0.0.1:" + server.address().port));
`,
	},
);
