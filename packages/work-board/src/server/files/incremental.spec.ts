import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, PubSub, Ref, Stream } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { searchSnapshot } from "#server/search/snapshot.ts";
import { folder } from "#test/board.ts";
import { watchChanges } from "./changes.ts";

it.live("coalesces more than 256 simultaneous writes into one revision and shares a single index update between readers", function* () {
	const paths = Array.from({ length: 300 }, (_, index) => `item-${index}.md`);
	const notes = folder(Object.fromEntries(paths.map((path) => [path, "# Before"])));
	const events = yield* PubSub.unbounded<FileSystem.WatchEvent>();
	let reads = 0;
	const services = Layer.effect(
		FileSystem.FileSystem,
		Effect.map(Effect.service(FileSystem.FileSystem), (fs) => ({
			...fs,
			readFileString: (path, encoding) =>
				Effect.suspend(() => {
					reads += 1;
					return fs.readFileString(path, encoding);
				}),
			watch: () => Stream.fromPubSub(events),
		})),
	).pipe(Layer.provideMerge(NodeServices.layer));
	try {
		yield* Effect.scoped(
			Effect.gen(function* () {
				const changes = yield* watchChanges(notes.root);
				const subscription = yield* PubSub.subscribe(changes.events);
				const index = yield* searchSnapshot(notes.root, undefined, changes);
				yield* index;
				reads = 0;
				const revision = yield* changes.revision;
				for (const path of paths) {
					notes.write(path, "# After");
				}
				const burst: FileSystem.WatchEvent[] = paths.flatMap((path) => [
					{ _tag: "Update", path },
					{ _tag: "Update", path },
				]);
				yield* PubSub.publishAll(events, burst);
				const change = yield* PubSub.take(subscription);
				expect(change).toMatchObject({ _tag: "Changed", paths: expect.arrayContaining(paths) });
				expect(yield* changes.revision).toBe(revision + 1);
				const snapshots = yield* Effect.all([index, index, index], { concurrency: "unbounded" });
				expect(reads).toBe(paths.length);
				expect(snapshots[0]).toBe(snapshots[1]);
				expect(snapshots[1]).toBe(snapshots[2]);
			}),
		).pipe(Effect.provide(services));
	} finally {
		notes.remove();
	}
});

it.live("ignores socket preparation events without restarting the watcher or rescanning Markdown", function* () {
	const notes = folder({
		".board.sock.starting/pending.md": "# Startup lock",
		".sABC123/pending.md": "# Socket preparation",
		"note.md": "# Notes",
	});
	const events = yield* PubSub.unbounded<FileSystem.WatchEvent>();
	let listings = 0;
	const services = Layer.effect(
		FileSystem.FileSystem,
		Effect.map(Effect.service(FileSystem.FileSystem), (fs) => ({
			...fs,
			readDirectory: (path, options) =>
				Effect.suspend(() => {
					listings += 1;
					return fs.readDirectory(path, options);
				}),
			watch: () => Stream.fromPubSub(events),
		})),
	).pipe(Layer.provideMerge(NodeServices.layer));
	try {
		yield* Effect.scoped(
			Effect.gen(function* () {
				const changes = yield* watchChanges(notes.root);
				const subscription = yield* PubSub.subscribe(changes.events);
				expect((yield* changes.files).map((file) => file.path)).toEqual(["note.md"]);
				const once = listings;
				const revision = yield* changes.revision;
				const burst: FileSystem.WatchEvent[] = [
					{ _tag: "Create", path: ".board.sock.starting" },
					{ _tag: "Update", path: ".board.sock.starting/pending.md" },
					{ _tag: "Create", path: ".sABC123" },
					{ _tag: "Update", path: ".sABC123/pending.md" },
					{ _tag: "Update", path: "note.md" },
				];
				yield* PubSub.publishAll(events, burst);
				expect(yield* PubSub.take(subscription)).toMatchObject({ _tag: "Changed", paths: ["note.md"] });
				expect(yield* changes.revision).toBe(revision + 1);
				expect(yield* Ref.get(changes.watching)).toBe(true);
				yield* changes.files;
				expect(listings).toBe(once);
			}),
		).pipe(Effect.provide(services));
	} finally {
		notes.remove();
	}
});
