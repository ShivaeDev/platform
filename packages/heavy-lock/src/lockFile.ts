import { Effect, FileSystem, Option, Path } from "effect";
import { decodeHolder, encodeHolder, type Holder } from "./holder.ts";
import { isHolderAlive } from "./processStart.ts";

const readContents = Effect.fn("HeavyLock.readContents")(function* (lock: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* fs.readFileString(lock).pipe(
		Effect.map(Option.some),
		Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(Option.none<string>())),
	);
});

export const readHolder = Effect.fn("HeavyLock.readHolder")(function* (lock: string) {
	return Option.flatMap(yield* readContents(lock), decodeHolder);
});

const removeDead = Effect.fn("HeavyLock.removeDead")(function* (lock: string, dead: Option.Option<Holder>) {
	const contents = yield* readContents(lock);
	if (Option.isNone(contents)) {
		return;
	}
	const current = decodeHolder(contents.value);
	if (Option.isSome(current) && (!Option.exists(dead, (holder) => holder.id === current.value.id) || (yield* isHolderAlive(current.value)))) {
		return;
	}
	const fs = yield* FileSystem.FileSystem;
	yield* fs.remove(lock, { force: true });
});

// Reclaimers serialize the check and removal; a live holder's path never disappears.
export const reclaim = Effect.fn("HeavyLock.reclaim")(function* (lock: string, dead: Option.Option<Holder>) {
	const fs = yield* FileSystem.FileSystem;
	const gate = `${lock}.reclaim`;
	yield* Effect.uninterruptible(
		Effect.acquireUseRelease(
			fs.makeDirectory(gate).pipe(
				Effect.as(true),
				Effect.catchReason("PlatformError", "AlreadyExists", () => Effect.succeed(false)),
				Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(false)),
			),
			(acquired) => (acquired ? removeDead(lock, dead) : Effect.void),
			(acquired) => (acquired ? fs.remove(gate, { recursive: true }) : Effect.void),
		),
	);
});

const linked = Effect.fn("HeavyLock.linked")(function* (draft: string, lock: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* fs.link(draft, lock).pipe(
		Effect.as(true),
		Effect.catchReason("PlatformError", "AlreadyExists", () => Effect.succeed(false)),
	);
});

const linkOrFindBlocker = Effect.fn("HeavyLock.linkOrFindBlocker")(function* (draft: string, lock: string) {
	while (!(yield* linked(draft, lock))) {
		const current = yield* readHolder(lock);
		if (Option.isSome(current) && (yield* isHolderAlive(current.value))) {
			return current;
		}
		yield* reclaim(lock, current);
	}
	return Option.none<Holder>();
});

// Hard-linking a complete draft publishes the holder atomically, so the lock file is never read half-written.
export const tryAcquire = Effect.fn("HeavyLock.tryAcquire")(function* (lock: string, holder: Holder) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	yield* fs.makeDirectory(path.dirname(lock), { recursive: true });
	const draft = `${lock}.${holder.id}.draft`;
	const contents = yield* encodeHolder(holder);
	return yield* Effect.acquireUseRelease(
		Effect.succeed(draft),
		() => Effect.andThen(fs.writeFileString(draft, contents), linkOrFindBlocker(draft, lock)),
		() => fs.remove(draft, { force: true }),
	).pipe(Effect.onError(() => release(lock, holder.id).pipe(Effect.orDie)));
});

export const release = Effect.fn("HeavyLock.release")(function* (lock: string, id: string) {
	const current = yield* readHolder(lock);
	if (Option.exists(current, (holder) => holder.id === id)) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.remove(lock, { force: true });
	}
});
