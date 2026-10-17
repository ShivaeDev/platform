import { Deferred, Effect } from "effect";
import type { PostgresEngine } from "./postgresEngine.ts";

export const pendingWrite = Effect.fn("PrismaStory.pendingWrite")(function* (engine: PostgresEngine) {
	const started = yield* Deferred.make<void>();
	const fiber = yield* engine.changes
		.use((db) => {
			Effect.runSync(Deferred.succeed(started, undefined));
			return db.order.create({ data: { id: "o1", ownerId: "ada", total: 1 } });
		})
		.pipe(Effect.forkChild);
	yield* Deferred.await(started);
	return fiber;
});
