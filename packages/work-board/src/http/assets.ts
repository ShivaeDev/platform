import { createRequire } from "node:module";
import { Data, Effect, FileSystem, Path } from "effect";
import type { HttpRouter, HttpServerRequest } from "effect/unstable/http";
import { diagnosticsScript } from "#diagnostics/script.ts";
import { historyScript } from "#history/script.ts";
import { ageScript } from "#page/ageScript.ts";
import { client, preferences } from "#page/client.ts";
import { diagrams } from "#page/diagrams.ts";
import { libraryScript } from "#page/libraryScript.ts";
import { navigationScript } from "#page/navigationScript.ts";
import { readingStateScript } from "#page/readingStateScript.ts";
import { searchResultsScript } from "#page/searchResultsScript.ts";
import { searchScript } from "#page/searchScript.ts";
import { sidebarScript } from "#page/sidebarScript.ts";
import { pageStateScript } from "#page/stateScript.ts";
import { style } from "#page/style.ts";
import { swap } from "#page/swap.ts";
import { visualScript } from "#page/visualScript.ts";
import { visualViewport } from "#page/visualViewport.ts";
import { savedScript } from "#views/savedScript.ts";
import { respond } from "./respond.ts";

export const ASSETS: ReadonlyArray<readonly [HttpRouter.PathInput, string, string]> = [
	["/_board/style.css", style, "text/css"],
	["/_board/diagnostics.js", diagnosticsScript(), "text/javascript"],
	["/_board/visuals.js", visualScript(), "text/javascript"],
	["/_board/visual-viewport.js", visualViewport(), "text/javascript"],
	["/_board/saved-views.js", savedScript(), "text/javascript"],
	["/_board/client.js", client, "text/javascript"],
	["/_board/ages.js", ageScript(), "text/javascript"],
	["/_board/history.js", historyScript(), "text/javascript"],
	["/_board/preferences.js", preferences, "text/javascript"],
	["/_board/search.js", searchScript(), "text/javascript"],
	["/_board/search-results.js", searchResultsScript(), "text/javascript"],
	["/_board/sidebar.js", sidebarScript(), "text/javascript"],
	["/_board/library.js", libraryScript(), "text/javascript"],
	["/_board/navigation.js", navigationScript(), "text/javascript"],
	["/_board/page-state.js", pageStateScript(), "text/javascript"],
	["/_board/reading-state.js", readingStateScript(), "text/javascript"],
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

export const NATIVE_ROUTE: HttpRouter.PathInput = "/_board/native.js";
const NATIVE_MISSING =
	"Work Board browser bundle assets/native.js is missing. Run pnpm --filter @shivaedev/work-board build:browser from the repository root to build it.";

const bundledPath = Effect.fn("WorkBoard.bundledPath")(function* (file: string) {
	const path = yield* Path.Path;
	const module = yield* path.fromFileUrl(new URL(import.meta.url)).pipe(Effect.orDie);
	return path.resolve(path.dirname(module), "../../assets", file);
});

export const checkNativeAsset = Effect.fn("WorkBoard.checkNativeAsset")(function* () {
	const fs = yield* FileSystem.FileSystem;
	if (!(yield* fs.exists(yield* bundledPath("native.js")))) {
		yield* Effect.logWarning(NATIVE_MISSING);
	}
});

export const nativeAsset = Effect.fn("WorkBoard.nativeAsset")(function* () {
	const fs = yield* FileSystem.FileSystem;
	return yield* fs.readFile(yield* bundledPath("native.js")).pipe(
		Effect.map((body) => respond(body, "text/javascript")),
		Effect.catchIf(
			(error) => error.reason._tag === "NotFound",
			() => Effect.succeed(respond(NATIVE_MISSING, "text/plain", 500)),
		),
	);
});

const BUNDLED_ASSETS: ReadonlyArray<readonly [HttpRouter.PathInput, ReturnType<typeof bundledAsset>]> = [
	[NATIVE_ROUTE, nativeAsset],
	["/_board/react.js", bundledAsset("react.js", "text/javascript")],
	["/_board/react.css", bundledAsset("react.css", "text/css")],
];

function bundledAsset(file: string, contentType: string) {
	return Effect.fn("WorkBoard.bundledAsset")(function* () {
		const fs = yield* FileSystem.FileSystem;
		return respond(yield* fs.readFile(yield* bundledPath(file)), contentType);
	});
}

export const ASSET_HANDLERS = [
	...ASSETS.map(([route, body, type]) => [route, () => Effect.succeed(respond(body, type))] as const),
	...BUNDLED_ASSETS,
];
