import { Effect } from "effect";
import type { BoardSnapshot } from "#board/readPass.ts";
import { warnSnapshotProblems } from "#board/warnSnapshotProblems.ts";
import type { BoardFailure } from "#policy.ts";

type Read = Effect.Effect<BoardSnapshot, BoardFailure>;
const pending = new Map<string, Read>();

export const sharedRead = Effect.fnUntraced(function* (root: string, read: Read, fresh = false): Effect.fn.Return<BoardSnapshot, BoardFailure> {
	const running = pending.get(root);
	if (running !== undefined) {
		if (!fresh) {
			return yield* running;
		}
		yield* Effect.exit(running).pipe(Effect.asVoid);
		return yield* sharedRead(root, read);
	}
	const next = yield* Effect.cached(
		read.pipe(
			Effect.tap((snapshot) => warnSnapshotProblems(root, snapshot)),
			Effect.ensuring(Effect.sync(() => pending.delete(root))),
		),
	);
	const shared = pending.get(root) ?? next;
	pending.set(root, shared);
	return yield* shared;
});
