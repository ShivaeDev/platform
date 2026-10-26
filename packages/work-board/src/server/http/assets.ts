import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Effect, FileSystem, Path, Schema } from "effect";
import { type HttpRouter, type HttpServerRequest, HttpServerResponse } from "effect/http";
import { InternalServerError } from "@shivaedev/contract/errors/taxonomy.ts";
import { INITIAL_THEME_SCRIPT, THEME_ROUTE } from "#server/page/initialTheme.ts";
import { HEADERS, respond } from "./respond.ts";

export const ASSETS: ReadonlyArray<readonly [HttpRouter.PathInput, string, string]> = [[THEME_ROUTE, INITIAL_THEME_SCRIPT, "text/javascript"]];

const MERMAID = "/_board/mermaid/";

const IMMUTABLE = "max-age=31536000, immutable";
const REVALIDATE = "no-cache";

function cacheable(request: HttpServerRequest.HttpServerRequest, body: string | Uint8Array, contentType: string, cacheControl: string) {
	const etag = `W/"${createHash("sha256").update(body).digest("base64url").slice(0, 32)}"`;
	const headers = { "cache-control": cacheControl, etag };
	const known = (request.headers["if-none-match"] ?? "").split(",").map((tag) => tag.trim().replace(/^W\//u, ""));
	if (known.includes(etag.slice(2)) || known.includes("*")) {
		return HttpServerResponse.empty({ headers: { ...HEADERS, ...headers }, status: 304 });
	}
	return HttpServerResponse.setHeaders(respond(body, contentType), headers);
}

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
		// Mermaid's build names every file under chunks/ after its content hash; only its entry keeps a fixed name.
		const hashed = file.startsWith(path.join(root, "chunks") + path.sep);
		return cacheable(request, yield* fs.readFile(file), "text/javascript", hashed ? IMMUTABLE : REVALIDATE);
	});
}

export const MERMAID_ROUTE: HttpRouter.PathInput = `${MERMAID}*`;

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

export function checkBrowserAssets() {
	return checkAssets(["react.js", "react.css"]);
}

const BUNDLED_ASSETS: ReadonlyArray<readonly [HttpRouter.PathInput, ReturnType<typeof bundledAsset>]> = [
	["/_board/react.js", bundledAsset("react.js", "text/javascript", REVALIDATE)],
	["/_board/react.css", bundledAsset("react.css", "text/css", REVALIDATE)],
];

const CHUNK_TYPES: Readonly<Record<string, string>> = { js: "text/javascript", woff2: "font/woff2" };

const reactChunk = Effect.fn("WorkBoard.reactChunk")(function* (request: HttpServerRequest.HttpServerRequest) {
	const name = new URL(request.url, "http://127.0.0.1").pathname.slice("/_board/react-assets/".length);
	const type = /^[a-zA-Z\d_-]+\.(?<extension>js|woff2)$/u.exec(name)?.groups?.extension;
	if (!type) {
		return respond("Not found", "text/plain", 404);
	}
	// vite.config.ts names every file under react-assets/ with its content hash.
	return yield* bundledAsset(`react-assets/${name}`, CHUNK_TYPES[type] ?? "text/javascript", IMMUTABLE)(request);
});

function bundledAsset(file: string, contentType: string, cacheControl: string) {
	return Effect.fn("WorkBoard.bundledAsset")(function* (request: HttpServerRequest.HttpServerRequest) {
		const fs = yield* FileSystem.FileSystem;
		return yield* fs.readFile(yield* bundledPath(file)).pipe(
			Effect.map((body) => cacheable(request, body, contentType, cacheControl)),
			Effect.catchIf(
				(error) => error.reason._tag === "NotFound",
				() => Effect.succeed(respond(missingBundle(file), "text/plain", 500)),
			),
		);
	});
}

export const ASSET_HANDLERS = [
	...ASSETS.map(
		([route, body, type]) =>
			[route, (request: HttpServerRequest.HttpServerRequest) => Effect.succeed(cacheable(request, body, type, REVALIDATE))] as const,
	),
	...BUNDLED_ASSETS,
	["/_board/react-assets/*", reactChunk] as const,
];
