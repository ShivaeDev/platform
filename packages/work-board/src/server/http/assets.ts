import { createRequire } from "node:module";
import { Effect, FileSystem, Path, Schema } from "effect";
import type { HttpRouter, HttpServerRequest } from "effect/unstable/http";
import { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { diagnosticsScript } from "#client/diagnostics/script.ts";
import { historyScript } from "#client/history/script.ts";
import { ageScript } from "#client/page/ageScript.ts";
import { libraryScript } from "#client/page/libraryScript.ts";
import { navigationScript } from "#client/page/navigationScript.ts";
import { readingStateScript } from "#client/page/readingStateScript.ts";
import { client, preferences } from "#client/page/runtime.ts";
import { diagrams, swap } from "#client/page/scripts.ts";
import { searchResultsScript } from "#client/page/searchResultsScript.ts";
import { searchScript } from "#client/page/searchScript.ts";
import { sidebarScript } from "#client/page/sidebarScript.ts";
import { pageStateScript } from "#client/page/stateScript.ts";
import { visualScript } from "#client/page/visualScript.ts";
import { visualViewport } from "#client/page/visualViewport.ts";
import { savedScript } from "#client/views/savedScript.ts";
import { style } from "#server/page/style.ts";
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

export class MermaidMissing extends Schema.TaggedError<MermaidMissing>()("MermaidMissing", { cause: Schema.Unknown }) {
	override get message() {
		return "The Mermaid assets could not be found. Reinstall Work Board and restart it.";
	}
}

export const mermaidRoot = Effect.fn("WorkBoard.mermaidRoot")(function* () {
	const path = yield* Path.Path;
	const entry = yield* Effect.try({ catch: (cause) => new MermaidMissing({ cause }), try: () => createRequire(import.meta.url).resolve("mermaid") });
	return path.dirname(entry);
});

export function mermaidFile(root: string) {
	return Effect.fn("WorkBoard.mermaidFile")(function* (request: HttpServerRequest.HttpServerRequest) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const file = path.resolve(root, new URL(request.url, "http://127.0.0.1").pathname.slice(MERMAID.length));
		if (!(file.startsWith(`${root}${path.sep}`) && file.endsWith(".mjs") && (yield* fs.exists(file)))) {
			return respond("Not found", "text/plain", 404);
		}
		return respond(yield* fs.readFile(file), "text/javascript");
	});
}

export const MERMAID_ROUTE: HttpRouter.PathInput = `${MERMAID}*`;

export const NATIVE_ROUTE: HttpRouter.PathInput = "/_board/native.js";
function missingBundle(file: string) {
	return `Work Board browser bundle assets/${file} is missing. Run pnpm --filter @shivaedev/work-board build:browser from the repository root to build it.`;
}

const bundledPath = Effect.fn("WorkBoard.bundledPath")(function* (file: string) {
	const path = yield* Path.Path;
	const module = yield* path
		.fromFileUrl(new URL(import.meta.url))
		.pipe(Effect.mapError(() => new InternalServerError({ message: "The browser asset location is invalid. Reinstall Work Board and restart it." })));
	return path.resolve(path.dirname(module), "../../../assets", file);
});

const checkAssets = Effect.fn("WorkBoard.checkAssets")(function* (files: readonly string[]) {
	const fs = yield* FileSystem.FileSystem;
	for (const file of files) {
		if (!(yield* fs.exists(yield* bundledPath(file)))) {
			yield* Effect.logWarning(missingBundle(file));
		}
	}
});

export function checkNativeAsset() {
	return checkAssets(["native.js"]);
}
export function checkBrowserAssets() {
	return checkAssets(["native.js", "react.js", "react.css"]);
}
export const nativeAsset = bundledAsset("native.js", "text/javascript");

const BUNDLED_ASSETS: ReadonlyArray<readonly [HttpRouter.PathInput, ReturnType<typeof bundledAsset>]> = [
	[NATIVE_ROUTE, nativeAsset],
	["/_board/react.js", bundledAsset("react.js", "text/javascript")],
	["/_board/react.css", bundledAsset("react.css", "text/css")],
];

const reactChunk = Effect.fn("WorkBoard.reactChunk")(function* (request: HttpServerRequest.HttpServerRequest) {
	const name = new URL(request.url, "http://127.0.0.1").pathname.slice("/_board/react-assets/".length);
	if (!/^[a-zA-Z\d_-]+\.js$/u.test(name)) {
		return respond("Not found", "text/plain", 404);
	}
	return yield* bundledAsset(`react-assets/${name}`, "text/javascript")();
});

function bundledAsset(file: string, contentType: string) {
	return Effect.fn("WorkBoard.bundledAsset")(function* () {
		const fs = yield* FileSystem.FileSystem;
		return yield* fs.readFile(yield* bundledPath(file)).pipe(
			Effect.map((body) => respond(body, contentType)),
			Effect.catchIf(
				(error) => error.reason._tag === "NotFound",
				() => Effect.succeed(respond(missingBundle(file), "text/plain", 500)),
			),
		);
	});
}

export const ASSET_HANDLERS = [
	...ASSETS.map(([route, body, type]) => [route, () => Effect.succeed(respond(body, type))] as const),
	...BUNDLED_ASSETS,
	["/_board/react-assets/*", reactChunk] as const,
];
