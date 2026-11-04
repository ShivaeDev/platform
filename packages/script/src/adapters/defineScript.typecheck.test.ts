import { Effect } from "effect";
import { Argument, Flag } from "effect/cli";
import { expectTypeOf } from "vitest";
import { defineScript } from "./defineScript.ts";

defineScript({
	args: {
		count: Flag.Int("count").pipe(Flag.withDefault(1)),
		name: Argument.String("name"),
	},
	run: (args) => {
		expectTypeOf(args).toEqualTypeOf<{ readonly count: number; readonly name: string }>();
		return Effect.void;
	},
});
