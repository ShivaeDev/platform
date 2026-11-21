import { type Cause, Effect, Layer, type Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { usePendingCommand } from "#client/pendingCommand.ts";

const command = {
	run: (input: { readonly enabled: boolean }) => (input.enabled ? Effect.succeed(42) : Effect.fail("Locked" as const)),
	runtime: Atom.runtime(Layer.empty),
};
export function useTypedPendingCommand() {
	const state = usePendingCommand(command, { value: false, wanted: (input) => input.enabled });
	const value: boolean = state.value;
	const result: Option.Option<number> = state.data;
	const failure: Option.Option<Cause.Cause<"Locked">> = state.cause;
	// @ts-expect-error The command input remains typed.
	state.dispatch({ enabled: "yes" });
	// @ts-expect-error The wanted value retains its type.
	const text: string = state.value;
	void text;
	return { failure, result, value };
}
