import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"releases the real HTTP listener after a scoped read succeeds",
	[projectFiles({ "home.md": "# Home" }), deferredServing],
	function* ({ start, request }) {
		const url = yield* Effect.scoped(
			Effect.gen(function* () {
				const board = yield* start();
				expect((yield* request("/")).status).toBe(HttpStatus.fromLiteral("OK"));
				return board.url;
			}),
		);
		yield* Effect.promise(() => expect(fetch(url)).rejects.toThrow());
	},
);
boardStory.it(
	"releases the listener when the owning fiber is interrupted",
	[projectFiles({ "home.md": "# Home" }), deferredServing],
	function* ({ start, request }) {
		const listening = yield* Deferred.make<string>();
		const owner = yield* Effect.scoped(
			Effect.gen(function* () {
				const board = yield* start();
				yield* Deferred.succeed(listening, board.url);
				return yield* Effect.never;
			}),
		).pipe(Effect.forkChild);
		const url = yield* Deferred.await(listening);
		expect((yield* request("/")).status).toBe(HttpStatus.fromLiteral("OK"));
		yield* Fiber.interrupt(owner);
		const stopped = yield* Fiber.await(owner);
		expect(Exit.isFailure(stopped) && Cause.hasInterrupts(stopped.cause)).toBe(true);
		yield* Effect.promise(() => expect(fetch(url)).rejects.toThrow());
	},
);
