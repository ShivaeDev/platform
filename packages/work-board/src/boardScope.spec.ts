import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { folder, startBoard } from "#test/board.ts";

it.live("releases the real HTTP listener when a scoped board read succeeds", function* () {
	const notes = folder({ "home.md": "# Home" });
	try {
		const url = yield* Effect.scoped(
			Effect.gen(function* () {
				const board = yield* startBoard(notes.root);
				expect((yield* Effect.promise(() => fetch(board.url))).status).toBe(200);
				return board.url;
			}),
		);
		yield* Effect.promise(() => expect(fetch(url)).rejects.toThrow());
	} finally {
		notes.remove();
	}
});

it.live("releases the real HTTP listener when its owning fiber is interrupted", function* () {
	const notes = folder({ "home.md": "# Home" });
	try {
		const listening = yield* Deferred.make<string>();
		const owner = yield* Effect.scoped(
			Effect.gen(function* () {
				const board = yield* startBoard(notes.root);
				yield* Deferred.succeed(listening, board.url);
				return yield* Effect.never;
			}),
		).pipe(Effect.forkChild);
		const url = yield* Deferred.await(listening);
		expect((yield* Effect.promise(() => fetch(url))).status).toBe(200);
		yield* Fiber.interrupt(owner);
		const stopped = yield* Fiber.await(owner);
		expect(Exit.isFailure(stopped) && Cause.hasInterrupts(stopped.cause)).toBe(true);
		yield* Effect.promise(() => expect(fetch(url)).rejects.toThrow());
	} finally {
		notes.remove();
	}
});
