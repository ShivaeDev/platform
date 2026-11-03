import { expectTypeOf, it } from "@effect/vitest";
import { Context, Data, Effect } from "effect";
import { captureOutcome } from "#server/captureOutcome.ts";

class Reader extends Context.Service<Reader, number>()("@shivaedev/test-story/capture/Reader") {}
class Denied extends Data.TaggedError("Denied")<{ readonly reason: string }> {}

it("infers every renderer result and keeps service requirements without an expected error", () => {
	const read = Reader.pipe(Effect.flatMap((value) => (value < 0 ? Effect.fail(new Denied({ reason: "negative" })) : Effect.succeed(value))));
	const captured = captureOutcome(read, {
		onDefect: () => null,
		onFailure: (error) => error.reason,
		onInterrupt: () => false,
		onSuccess: (value) => value,
	});

	expectTypeOf(captured).toEqualTypeOf<Effect.Effect<number | string | boolean | null, never, Reader>>();
});
