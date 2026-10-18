import { type Context, Deferred, Effect } from "effect";
import type { HeldLock } from "#held-lock.ts";
import { withHeavyLock } from "#with-heavy-lock.ts";
import { configured, type Lock } from "./lock.ts";

export const startCommand = Effect.fn("LockStory.startCommand")(function* (engine: Lock, parent?: Context.Context<HeldLock>) {
	const completion = yield* Deferred.make<void, string>();
	const acquired = yield* Deferred.make<Context.Context<HeldLock>>();
	const body = Effect.gen(function* () {
		yield* Deferred.succeed(acquired, yield* Effect.context<HeldLock>());
		yield* Deferred.await(completion);
	});
	const command = configured(engine, withHeavyLock(body, engine.options));
	const fiber = yield* Effect.forkChild(parent === undefined ? command : Effect.provide(command, parent));
	return { acquired, completion, fiber };
});

export type RunningCommand = Effect.Success<ReturnType<typeof startCommand>>;
