import { randomUUID } from "node:crypto";
import { Effect, FileSystem, Option, Path, type PlatformError } from "effect";
import { decodeHolder, encodeHolder, type Holder } from "./holder.ts";
import { isHolderAlive } from "./process-start.ts";

const hasReason = (tag: string) => (error: PlatformError.PlatformError) => error.reason._tag === tag;

export const readHolder = Effect.fn("HeavyLock.readHolder")(function* (lock: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* fs.readFileString(lock).pipe(
		Effect.map(decodeHolder),
		Effect.orElseSucceed(() => Option.none<Holder>()),
	);
});

const isLive = (holder: Option.Option<Holder>) => (Option.isSome(holder) ? isHolderAlive(holder.value) : Effect.succeed(false));

// A racing waiter may have replaced the dead lock with a live one before the rename; that lock goes back.
export const reclaim = Effect.fn("HeavyLock.reclaim")(function* (lock: string, dead: Option.Option<Holder>) {
	const fs = yield* FileSystem.FileSystem;
	const aside = `${lock}.${randomUUID()}.stale`;
	const moved = yield* fs.rename(lock, aside).pipe(
		Effect.as(true),
		Effect.catchIf(hasReason("NotFound"), () => Effect.succeed(false)),
	);
	if (!moved) {
		return;
	}
	const current = yield* readHolder(aside);
	const raced = Option.isSome(current) && !Option.exists(dead, (holder) => holder.id === current.value.id);
	if (raced && (yield* isLive(current))) {
		yield* fs.link(aside, lock).pipe(Effect.catchIf(hasReason("AlreadyExists"), () => Effect.void));
	}
	yield* fs.remove(aside, { force: true });
});

const linked = Effect.fn("HeavyLock.linked")(function* (draft: string, lock: string) {
	const fs = yield* FileSystem.FileSystem;
	return yield* fs.link(draft, lock).pipe(
		Effect.as(true),
		Effect.catchIf(hasReason("AlreadyExists"), () => Effect.succeed(false)),
	);
});

const linkOrFindBlocker = Effect.fn("HeavyLock.linkOrFindBlocker")(function* (draft: string, lock: string) {
	while (!(yield* linked(draft, lock))) {
		const current = yield* readHolder(lock);
		if (Option.isSome(current) && (yield* isLive(current))) {
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
	yield* fs.writeFileString(draft, yield* encodeHolder(holder));
	return yield* linkOrFindBlocker(draft, lock).pipe(Effect.ensuring(Effect.ignore(fs.remove(draft, { force: true }))));
});

export const release = Effect.fn("HeavyLock.release")(function* (lock: string, id: string) {
	const current = yield* readHolder(lock);
	if (Option.exists(current, (holder) => holder.id === id)) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.remove(lock, { force: true });
	}
});
