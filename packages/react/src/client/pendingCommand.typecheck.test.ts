import { type Cause, Effect, type Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { usePendingCommand } from "./pendingCommand.ts";

const command = Atom.fn<{ readonly enabled: boolean }>()((input) => (input.enabled ? Effect.succeed(42) : Effect.fail("Locked" as const)));
const query = Atom.make(Effect.succeed(false));
export function useTypedPendingCommand() {
	const state = usePendingCommand(command, { queries: [query], value: false, wanted: (input) => input.enabled });
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
