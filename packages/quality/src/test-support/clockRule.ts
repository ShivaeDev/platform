import { Clock, Console, Effect } from "effect";
import { defineRule } from "#rule.ts";

export const clockRule = defineRule({
	check: () =>
		Effect.gen(function* () {
			yield* Console.log(`Rule checked at ${yield* Clock.currentTimeMillis}`);
			return [];
		}),
	description: "Reports when the gate checks the repository.",
	id: "local/check-time",
});
