import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { workRpcs } from "#rpc/contract.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { inMemoryBoard } from "./inMemoryBoard.ts";
import type { BoardEngine } from "./storyEngine.ts";

export function attentionVerbs(_engine: BoardEngine, tell: (line: string) => void) {
	return {
		readInbox: (snapshot: Snapshot) =>
			Effect.scoped(
				Effect.gen(function* () {
					tell("the reader checks the inbox through the shared Board runtime");
					const client = yield* RpcTest.makeClient(workRpcs, { flatten: true });
					return yield* client("work-board.inbox", undefined);
				}),
			).pipe(Effect.provide(inMemoryBoard({}, { home: undefined, index: Effect.succeed(snapshot) }))),
	};
}
