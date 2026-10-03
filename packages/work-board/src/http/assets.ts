import { createRequire } from "node:module";
import { Data, Effect, FileSystem, Path } from "effect";
import type { HttpRouter, HttpServerRequest } from "effect/unstable/http";
import { client } from "../page/client.ts";
import { diagrams } from "../page/diagrams.ts";
import { style } from "../page/style.ts";
import { swap } from "../page/swap.ts";
import { respond } from "./respond.ts";

export const ASSETS: ReadonlyArray<readonly [HttpRouter.PathInput, string, string]> = [
	["/_board/style.css", style, "text/css"],
	["/_board/client.js", client, "text/javascript"],
	["/_board/diagrams.js", diagrams, "text/javascript"],
	["/_board/swap.js", swap, "text/javascript"],
];

const MERMAID = "/_board/mermaid/";

export class MermaidMissing extends Data.TaggedError("MermaidMissing")<{ readonly cause: unknown }> {}

export const mermaidRoot = Effect.fn("WorkBoard.mermaidRoot")(function* () {
	const path = yield* Path.Path;
	const entry = yield* Effect.try({ catch: (cause) => new MermaidMissing({ cause }), try: () => createRequire(import.meta.url).resolve("mermaid") });
	return path.dirname(entry);
});

export const mermaidFile = (mermaidRoot: string) =>
	Effect.fn("WorkBoard.mermaidFile")(function* (request: HttpServerRequest.HttpServerRequest) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const file = path.resolve(mermaidRoot, new URL(request.url, "http://127.0.0.1").pathname.slice(MERMAID.length));
		if (!(file.startsWith(`${mermaidRoot}${path.sep}`) && file.endsWith(".mjs") && (yield* fs.exists(file)))) {
			return respond("Not found", "text/plain", 404);
		}
		return respond(yield* fs.readFile(file), "text/javascript");
	});

export const MERMAID_ROUTE: HttpRouter.PathInput = `${MERMAID}*`;
