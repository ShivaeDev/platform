import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Stream } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { folder } from "#test/board.ts";
import { watchDirectories } from "./watchDirectories.ts";

it.live("fails a prematurely ended watcher in the error channel so the host can retry", function* () {
	const notes = folder({ "note.md": "# Note" });
	yield* Effect.addFinalizer(() => Effect.sync(notes.remove));
	const files = Layer.effect(
		FileSystem.FileSystem,
		Effect.map(FileSystem.FileSystem, (fs) => ({ ...fs, watch: () => Stream.empty })),
	).pipe(Layer.provide(NodeServices.layer));
	const failure = yield* watchDirectories(
		notes.root,
		notes.root,
		Effect.void,
		() => Effect.void,
		() => Effect.void,
	).pipe(Effect.provide(files), Effect.provide(NodeServices.layer), Effect.flip);
	expect(failure).toBeInstanceOf(ServiceUnavailable);
	expect(failure).toMatchObject({ message: "The workspace watcher ended. Retrying the watch automatically." });
});
