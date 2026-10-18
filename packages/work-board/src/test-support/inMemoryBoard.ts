import { ByteSize, Effect, FileSystem, Layer, Option, Path, type PlatformError, PubSub, Ref } from "effect";
import { DiagnosticsConfig, SourceFailure } from "#diagnostics/source.ts";
import { boardServices } from "#server/boardServices.ts";
import type { Change, Changes } from "#server/files/changes.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { Workspace, WorkspaceConfig } from "#server/workspace.ts";
import { fixtureSnapshot } from "./fixtureSnapshot.ts";

export interface BoardFixtureOptions {
	readonly beforeRead?: (kind: "document", url: string) => Effect.Effect<void>;
	readonly fleetPort?: number;
	readonly home: string | undefined;
	readonly index?: Effect.Effect<Snapshot, PlatformError.PlatformError>;
	readonly modified?: ReadonlyMap<string, number>;
	readonly writable?: boolean;
}

const missing = Effect.fail(new SourceFailure({ kind: "not-configured", message: "Source missing" }));

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
			const workspace = Layer.effect(Workspace)(
				Effect.map(Workspace, (service) => ({
					...service,
					document: (url: string) =>
						Effect.suspend(() => configuration?.beforeRead?.("document", url) ?? Effect.void).pipe(Effect.andThen(service.document(url))),
				})),
			).pipe(Layer.provide(Workspace.layer));
			return boardServices({ fleetPort: configuration?.fleetPort ?? null }).pipe(
				Layer.provide(workspace),
				Layer.provide([
					Layer.succeed(WorkspaceConfig, {
						changes,
						home,
						index: configuration?.index ?? fixtureSnapshot(files, home, configuration?.modified),
						root: "/board",
						writable: configuration?.writable === true,
					}),
					Layer.succeed(DiagnosticsConfig, { _tag: "Sources", sources: { codex: missing, fleet: missing, github: missing } }),
				]),
			);
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
