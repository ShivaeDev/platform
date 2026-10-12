import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { publishAfterBoardPass, withBoardReadPass } from "#board/readPass.ts";

it.effect("coalesces a publication until the pass ends, including a failed pass", function* () {
	let publications = 0;
	const publish = Effect.sync(() => {
		publications += 1;
	});
	const failed = yield* withBoardReadPass(
		Effect.gen(function* () {
			yield* publishAfterBoardPass(publish);
			yield* publishAfterBoardPass(publish);
			expect(publications).toBe(0);
			return yield* Effect.fail("stopped");
		}),
	).pipe(Effect.result);
	expect(failed).toMatchObject({ _tag: "Failure", failure: "stopped" });
	expect(publications).toBe(1);
	yield* publishAfterBoardPass(publish);
	expect(publications).toBe(2);
});

it.effect("a fiber inherited from an expired pass publishes immediately", function* () {
	let publications = 0;
	const publish = Effect.sync(() => {
		publications += 1;
	});
	const release = yield* Deferred.make<void>();
	const pending = yield* withBoardReadPass(
		Effect.gen(function* () {
			yield* publishAfterBoardPass(publish);
			return yield* Deferred.await(release).pipe(Effect.andThen(publishAfterBoardPass(publish)), Effect.forkScoped);
		}),
	);
	expect(publications).toBe(1);
	yield* Deferred.succeed(release, undefined);
	yield* Fiber.join(pending);
	expect(publications).toBe(2);
});
