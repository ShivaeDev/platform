import { Deferred, Effect, Fiber, FileSystem, Path } from "effect";

// Where a run stops until the story lets it continue: before it reads or removes a file it listed, once its draft of a file is
// written and not yet renamed over it, or before it lists the folder that holds another run's draft of a file.
export type HoldPoint =
	| { readonly before: "reading" | "removing"; readonly file: string }
	| { readonly before: "renaming its draft over"; readonly file: string }
	| { readonly before: "listing the draft folder of"; readonly file: string };

export interface HeldRun<A> {
	readonly fiber: Fiber.Fiber<A, unknown>;
	readonly release: Deferred.Deferred<void>;
}

// The real file system, which stops the run once at its hold point until the story releases it.
const holdingFileSystem = Effect.fn("BuildStory.holdingFileSystem")(function* (
	root: string,
	point: HoldPoint,
	reached: Deferred.Deferred<void>,
	release: Deferred.Deferred<void>,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const target = path.join(root, point.file);
	let armed = true;
	function holdIf(matches: boolean) {
		return Effect.suspend(() => {
			if (!(armed && matches)) {
				return Effect.void;
			}
			armed = false;
			return Effect.andThen(Deferred.succeed(reached, undefined), Deferred.await(release));
		});
	}
	function isDraftFolder(folder: string) {
		return path.dirname(folder) === path.dirname(target) && path.basename(folder).startsWith(`.${path.basename(target)}.`);
	}
	return FileSystem.FileSystem.of({
		...fs,
		readDirectoryEntries: (folder) =>
			Effect.andThen(holdIf(point.before === "listing the draft folder of" && isDraftFolder(folder)), fs.readDirectoryEntries(folder)),
		remove: (file, options) => Effect.andThen(holdIf(point.before === "removing" && file === target), fs.remove(file, options)),
		rename: (from, to) => Effect.andThen(holdIf(point.before === "renaming its draft over" && to === target), fs.rename(from, to)),
		stat: (file) => Effect.andThen(holdIf(point.before === "reading" && file === target), fs.stat(file)),
	});
});

export const startedHeld = Effect.fn("BuildStory.startedHeld")(function* <A, E, R>(
	name: string,
	root: string,
	point: HoldPoint,
	run: Effect.Effect<A, E, R>,
) {
	const reached = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const fs = yield* holdingFileSystem(root, point, reached, release);
	const fiber = yield* Effect.forkScoped(run.pipe(Effect.provideService(FileSystem.FileSystem, fs)));
	const isHeld = yield* Effect.raceFirst(Effect.as(Deferred.await(reached), true), Effect.as(Fiber.await(fiber), false));
	if (!isHeld) {
		return yield* Effect.die(new Error(`${name} ended without ${point.before} ${point.file}`));
	}
	const held: HeldRun<A> = { fiber, release };
	return held;
});
