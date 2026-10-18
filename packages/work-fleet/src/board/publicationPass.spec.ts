import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { withBoardReadPass } from "#board/readPass.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it(
	"coalesces a publication until the pass ends, including a failed pass",
	[hasBoardItems(1)],
	function* ({ deferStatus, publicationCount, publishedStatus }) {
		const failed = yield* withBoardReadPass(
			Effect.gen(function* () {
				yield* deferStatus();
				yield* deferStatus();
				expect(publicationCount()).toBe(0);
				expect(yield* publishedStatus()).toBeUndefined();
				return yield* Effect.fail("stopped");
			}),
		).pipe(Effect.result);
		expect(failed).toMatchObject({ _tag: "Failure", failure: "stopped" });
		expect(publicationCount()).toBe(1);
		expect(yield* publishedStatus()).toContain("item.0");
		yield* deferStatus();
		expect(publicationCount()).toBe(2);
	},
);
boardReadStory.it(
	"a fiber inherited from an expired pass publishes immediately",
	[hasBoardItems(1)],
	function* ({ deferStatus, publicationCount, publishedStatus }) {
		const release = yield* Deferred.make<void>();
		const pending = yield* withBoardReadPass(
			Effect.gen(function* () {
				yield* deferStatus();
				return yield* Deferred.await(release).pipe(Effect.andThen(deferStatus()), Effect.forkScoped);
			}),
		);
		expect(publicationCount()).toBe(1);
		expect(yield* publishedStatus()).toContain("item.0");
		yield* Deferred.succeed(release, undefined);
		yield* Fiber.join(pending);
		expect(publicationCount()).toBe(2);
	},
);
