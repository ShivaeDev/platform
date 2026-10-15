import { ByteSize, Context, Effect, FileSystem, Layer, Option, Path, PubSub, Ref } from "effect";
import { Diagnostics, DiagnosticsConfig, SourceFailure } from "#diagnostics/source.ts";
import { readDocument } from "#server/document/read.ts";
import type { Change, Changes } from "#server/files/changes.ts";
import { HandoffsService } from "#server/handoffs/Service.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { ResponseConfig, Responses } from "#server/responses/service.ts";
import { handlers } from "#server/rpc/handlers.ts";
import { fixtureSnapshot } from "./fixtureSnapshot.ts";

export interface BoardFixtureOptions {
	readonly beforeRead?: (kind: "document" | "page", url: string) => Effect.Effect<void>;
	readonly home: string | undefined;
	readonly modified?: ReadonlyMap<string, number>;
}

const missing = Effect.fail(new SourceFailure({ kind: "not-configured", message: "Source missing" }));
const missingDiagnostics = Diagnostics.layer.pipe(
	Layer.provide(Layer.succeed(DiagnosticsConfig, { _tag: "Sources", sources: { codex: missing, fleet: missing, github: missing } })),
);

export function inMemoryBoard(files: Readonly<Record<string, string>>, configuration?: BoardFixtureOptions) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const home = configuration ? configuration.home : Object.keys(files)[0];
			const changes: Changes = {
				events: yield* Effect.acquireRelease(PubSub.unbounded<Change>(), PubSub.shutdown),
				files: Effect.sync(() => Object.keys(files).map((file) => ({ modified: configuration?.modified?.get(file) ?? 0, path: file }))),
				realRoot: "/board",
				revision: Effect.succeed(0),
				watching: yield* Ref.make(false),
			};
			const options = { changes, enabled: false, index: fixtureSnapshot(files, home, configuration?.modified), root: "/board" };
			const services = yield* Layer.build(
				Layer.mergeAll(Responses.layer, HandoffsService.layer, missingDiagnostics).pipe(Layer.provide(Layer.succeed(ResponseConfig, options))),
			);
			const context = Context.merge(yield* Effect.context<Highlighter | FileSystem.FileSystem | Path.Path>(), services);
			return yield* handlers({
				...options,
				document: (url) =>
					Effect.suspend(() => configuration?.beforeRead?.("document", url) ?? Effect.void).pipe(
						Effect.andThen(readDocument({ ...options, home, writable: false })(url)),
						Effect.provideContext(context),
					),
				fleetPort: null,
				home,
			}).pipe(Effect.provideContext(context));
		}),
	).pipe(
		Layer.provide([
			FileSystem.layerNoop({
				readFileString: (path) => Effect.succeed(files[path.slice("/board/".length)] ?? ""),
				realPath: (path) => Effect.succeed(path),
				stat: () =>
					Effect.succeed({
						atime: Option.none(),
						birthtime: Option.none(),
						blksize: Option.none(),
						blocks: Option.none(),
						dev: 0,
						gid: Option.none(),
						ino: Option.none(),
						mode: 0,
						mtime: Option.none(),
						nlink: Option.none(),
						rdev: Option.none(),
						size: ByteSize.zero,
						type: "Directory",
						uid: Option.none(),
					}),
			}),
			Path.layer,
			Highlighter.layer,
		]),
	);
}
