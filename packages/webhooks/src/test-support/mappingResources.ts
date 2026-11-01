import { Data, Deferred, Effect, type Fiber, Schema, type Scope } from "effect";
import { webhookEvent, webhookJob } from "#server/registration.ts";
import { issueQueue } from "#test/fixture.ts";

class MappingRefused extends Data.TaggedError("MappingRefused") {}

interface MappingResources {
	blocked: boolean;
	readonly lifecycle: string[];
	readonly permit: Deferred.Deferred<void>;
	refused: boolean;
	request: Fiber.Fiber<string> | undefined;
	readonly scopes: Scope.Scope[];
	readonly waiting: Deferred.Deferred<void>;
}

export function mappingResources(): MappingResources {
	return {
		blocked: false,
		lifecycle: [],
		permit: Deferred.makeUnsafe<void>(),
		refused: false,
		request: undefined,
		scopes: [],
		waiting: Deferred.makeUnsafe<void>(),
	};
}

export function resourceEvent(state: ReturnType<typeof mappingResources>) {
	return webhookEvent(Schema.Struct({ issue: Schema.Struct({ number: Schema.Number }) }), ({ issue }) =>
		Effect.gen(function* () {
			const scope = yield* Effect.scope;
			yield* Effect.acquireRelease(
				Effect.sync(() => {
					state.scopes.push(scope);
					state.lifecycle.push(`opened for issue ${issue.number}`);
				}),
				() => Effect.sync(() => state.lifecycle.push(`closed for issue ${issue.number}`)),
			);
			if (state.blocked) {
				yield* Effect.acquireRelease(
					Deferred.succeed(state.waiting, undefined).pipe(Effect.andThen(Deferred.await(state.permit)), Effect.interruptible),
					() => Effect.void,
				);
			}
			if (state.refused) {
				return yield* new MappingRefused();
			}
			return [webhookJob(issueQueue, { number: issue.number })];
		}),
	);
}
