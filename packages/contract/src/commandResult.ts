import { Effect, Option, Ref } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { CommandResultKeys } from "#internal/CommandResultKeys.ts";

export const commandResult = Effect.fnUntraced(function* <A>(value: {
	readonly result: A;
	readonly invalidates: readonly Key[];
}): Effect.fn.Return<A> {
	const keys = yield* Effect.serviceOption(CommandResultKeys);
	if (Option.isNone(keys)) {
		return yield* Effect.die("commandResult requires the command guard");
	}
	yield* Ref.update(keys.value, (previous) => [...previous, ...value.invalidates]);
	return value.result;
});
