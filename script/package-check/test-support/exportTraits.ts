import { dirname, join } from "node:path";
import { FileSystem } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { writeJson } from "#package-check/io.ts";
import type { Manifest } from "#package-check/model.ts";
import { archives } from "#package-check/test-support/archives.ts";

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
			"./*.ts": { "@shivaedev/source": "./src/server/*.ts", import: "./dist/server/*.js" },
			"./board.ts": { "@shivaedev/source": "./src/server/board.ts", import: "./dist/server/board.js" },
			"./cli.ts": { "@shivaedev/source": "./src/server/cli.ts", import: "./dist/server/cli.js" },
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

export const publishedExecutableExport = exportTraits(
	"a workspace bin runs a source launcher and publishConfig packs the executable that shares an export pattern",
	{
		bin: { board: "./bin/source.ts" },
		exports: {
			"./*.ts": { "@shivaedev/source": "./src/server/*.ts", import: "./dist/server/*.js" },
		},
		files: ["dist", "src"],
		name: "board",
		publishConfig: { bin: { board: "./dist/server/cli.js" } },
		version: "1.0.0",
	},
	{
		"bin/source.ts": 'import "#cli.ts";',
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
			"./*.ts": { "@shivaedev/source": "./src/*.ts", import: "./dist/*.js" },
			"./browser/responses/*": null,
			"./browser/responses/schema.ts": { "@shivaedev/source": "./src/browser/responses/schema.ts", import: "./dist/browser/responses/schema.js" },
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
		exports: { "./loadQuery.ts": null, "./router.ts": { "@shivaedev/source": "./src/loadQuery.ts", import: "./dist/loadQuery.js" } },
		name: "router",
		version: "1.0.0",
	},
	{ "dist/loadQuery.js": "export {};", "src/loadQuery.ts": "export {};" },
);

export const selectedPattern = exportTraits(
	"specific export patterns select modules ahead of the root wildcard",
	{
		exports: {
			"./*.ts": { "@shivaedev/source": "./src/*.ts", import: "./dist/*.js" },
			"./browser/document/*.ts": { "@shivaedev/source": "./src/client/document/*.ts", import: "./dist/client/document/*.js" },
			"./rpc/*.ts": { "@shivaedev/source": "./src/server/rpc/*.ts", import: "./dist/server/rpc/*.js" },
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
	"the packed server executable serves unrelated JavaScript as its browser client",
	{ bin: { board: "./server.js" }, name: "board", version: "1.0.0" },
	{
		"server.js": `import { createServer } from "node:http";
const server = createServer((request, response) => {
  response.writeHead(${HttpStatus.fromLiteral("OK")}, { "content-type": "text/javascript" });
  response.end(request.url === "/client.js" ? "const unrelated = true; export { unrelated as session };" : "server");
});
server.listen(0, "127.0.0.1", () => console.log("http://127.0.0.1:" + server.address().port));
`,
	},
);
