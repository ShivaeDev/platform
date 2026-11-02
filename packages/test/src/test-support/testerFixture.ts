import { Data, Effect } from "effect";
import { it } from "#adapters/it.ts";
import { note } from "./lifecycleLog.ts";

class BodyFailure extends Data.TaggedError("BodyFailure")<{ readonly message: string }> {}

it.effect("an it.effect body that fails", function* () {
	return yield* new BodyFailure({ message: "the body failed" });
});

it.effect.skipIf(true)("an it.effect body behind a true skip condition", function* () {
	yield* note("the skipped body ran");
});

it("a plain Vitest test", () => Effect.runSync(note("the plain test ran")));

it.effect.each(["alpha", "beta"])("it.effect.each case %s", function* (item) {
	yield* note(`the body received ${item}`);
});
