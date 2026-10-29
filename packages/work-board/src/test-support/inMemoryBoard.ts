import { ByteSize, Effect, FileSystem, Layer, Option, Path, type PlatformError, PubSub, Ref } from "effect";
import { stringify } from "yaml";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import type { FleetHealth } from "#diagnostics/health.ts";
import { DiagnosticsConfig, SourceFailure } from "#diagnostics/source.ts";
import { workRpcs } from "#rpc/contract.ts";
import { boardServices } from "#server/boardServices.ts";
import type { Change, Changes } from "#server/files/changes.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { Workspace, WorkspaceConfig } from "#server/workspace.ts";
import { health } from "#test/diagnostics.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { fixtureSnapshot } from "#test/fixtureSnapshot.ts";
import { memoryFiles } from "#test/memoryFiles.ts";

export interface BoardFixtureOptions {
	readonly afterRead?: (url: string) => Effect.Effect<void>;
	readonly beforeIndex?: (files: readonly string[]) => Effect.Effect<void, PlatformError.PlatformError>;
	readonly beforeRead?: (kind: "document", url: string) => Effect.Effect<void>;
	readonly beforeStart?: Effect.Effect<void>;
	readonly fleet?: FleetItemsProjection;
	readonly fleetHealth?: FleetHealth;
	readonly fleetPort?: number;
	readonly home?: string | undefined;
	readonly index?: Effect.Effect<Snapshot, PlatformError.PlatformError>;
	readonly modified?: ReadonlyMap<string, number>;
	readonly pullRequests?: string;
	readonly writable?: boolean;
}

const missing = Effect.fail(new SourceFailure({ kind: "not-configured", message: "Source missing" }));

export function inMemoryBoard(files: Readonly<Record<string, string>>, configuration?: BoardFixtureOptions) {
	return Layer.unwrap(
		Effect.gen(function* () {
			yield* configuration?.beforeStart ?? Effect.void;
			const seeded = fleetFiles(files, configuration?.fleet);
			const memory = yield* memoryFiles(files, configuration?.writable === true, seeded);
			let fleetPort = configuration?.fleetPort ?? null;
			if (configuration?.fleet?.state === "ready") {
				const fleet = configuration.fleet;
				const daemon = yield* diagnosticsDaemon(
					() => ({
						codex: { cause: "Not configured", observedAt: 0, state: "not-configured" },
						fleet: { observedAt: 0, state: "ready", value: health },
						github: { cause: "Not configured", observedAt: 0, state: "not-configured" },
					}),
					0,
					() => fleet,
				);
				fleetPort = daemon.port;
			}
			const home = configuration && "home" in configuration ? configuration.home : Object.keys(files)[0];
			let indexed: { readonly files: Readonly<Record<string, string>>; readonly snapshot: Effect.Effect<Snapshot> } | undefined;
			const index = Effect.gen(function* () {
				const current = memory.files();
				if (!(indexed && sameFiles(indexed.files, current))) {
					indexed = { files: current, snapshot: yield* Effect.cached(fixtureSnapshot(current, home, configuration?.modified)) };
				}
				return yield* indexed.snapshot;
			});
			const changes: Changes = {
				events: yield* Effect.acquireRelease(PubSub.unbounded<Change>(), PubSub.shutdown),
				files: Effect.sync(() => Object.keys(files).map((file) => ({ modified: configuration?.modified?.get(file) ?? 0, path: file }))),
				realRoot: memory.root,
				revision: Effect.succeed(0),
				watching: yield* Ref.make(false),
			};
			const workspace = Layer.effect(Workspace)(
				Effect.map(Workspace, (service) => ({
					...service,
					document: (url: string) =>
						Effect.suspend(() => configuration?.beforeRead?.("document", url) ?? Effect.void).pipe(
							Effect.andThen(service.document(url)),
							Effect.tap(() => configuration?.afterRead?.(url) ?? Effect.void),
						),
				})),
			).pipe(Layer.provide(Workspace.layer));
			const services = boardServices({ fleetPort }).pipe(
				Layer.provide(workspace),
				Layer.provide([
					Layer.succeed(WorkspaceConfig, {
						changes,
						home,
						index: Effect.suspend(() => configuration?.beforeIndex?.(Object.keys(memory.files())) ?? Effect.void).pipe(
							Effect.andThen(configuration?.index ?? index),
						),
						pullRequests: Effect.succeed(configuration?.pullRequests),
						root: memory.root,
						writable: configuration?.writable === true,
					}),
					Layer.succeed(DiagnosticsConfig, {
						_tag: "Sources",
						sources: { codex: missing, fleet: configuration?.fleetHealth ? Effect.succeed(configuration.fleetHealth) : missing, github: missing },
					}),
				]),
				Layer.provide([fixtureFileSystem(memory), Path.layer, Highlighter.layer]),
			);
			return hostChanges(workRpcs, AppChanges).pipe(Layer.provideMerge(services));
		}),
	);
}

function sameFiles(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>) {
	const paths = Object.keys(left);
	return paths.length === Object.keys(right).length && paths.every((path) => right[path] === left[path]);
}

function fleetFiles(files: Readonly<Record<string, string>>, fleet?: FleetItemsProjection) {
	const seeded: Record<string, string> = {};
	if (fleet?.state === "ready") {
		for (const item of [...fleet.items, ...fleet.completed]) {
			if (item.document && files[item.document.file] === undefined) {
				seeded[item.document.file] = `---\n${stringify(item.document.metadata)}---\n# ${item.document.title}\n`;
			}
		}
	}

	return seeded;
}

function fixtureFileSystem(memory: { readonly root: string; readonly files: () => Readonly<Record<string, string>> }) {
	return FileSystem.layerNoop({
		readFileString: (path) => Effect.succeed(memory.files()[path.slice(memory.root.length + 1)] ?? ""),
		realPath: (path) => Effect.succeed(path),
		stat: () =>
			Effect.succeed({
				atime: Option.none(),
				birthtime: Option.none(),
				blksize: Option.none(),
				blocks: Option.none(),
				dev: 0n,
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
	});
}
