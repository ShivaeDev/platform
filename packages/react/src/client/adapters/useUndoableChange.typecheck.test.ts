import { Context, Effect, Layer, type Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { Conflict } from "@shivaedev/errors/taxonomy.ts";
import type { deployUpdate } from "#client/deployUpdate.ts";
import { useUndoableChange } from "./useUndoableChange.ts";

class Store extends Context.Service<Store, { readonly name: string }>()("@shivaedev/react/test/UndoStore") {}
class Missing extends Context.Service<Missing, { readonly name: string }>()("@shivaedev/react/test/MissingUndoStore") {}
const runtime = Atom.runtime(Layer.succeed(Store, { name: "first" }));
const failingRuntime = Atom.runtime(Layer.effect(Store, Effect.fail("Unavailable" as const)));
interface Input {
	readonly expectedVersion: number;
	readonly id: string;
	readonly removed: boolean;
}
interface Row {
	readonly id: string;
	readonly version: number;
}
const run: (input: Input) => Effect.Effect<Row, Conflict, Store> = Effect.fnUntraced(function* (input: Input) {
	yield* Store;
	return { id: input.id, version: 8 };
});
const missing = Effect.fnUntraced(function* (_input: Input) {
	yield* Missing;
	return { version: 8 };
});

export function useUndoTypes(update: ReturnType<typeof deployUpdate>) {
	const change = useUndoableChange({ run, runtime, update }, { describe: (row, input) => `${row.id}: ${input.removed}` });
	const failure: AsyncResult.AsyncResult<Row, Conflict> = change.undoResult;
	const notice: Option.Option<{ readonly value: Row; readonly input: Input; readonly message: string }> = change.notice;
	const runtimeFailure: AsyncResult.AsyncResult<Row, Conflict | "Unavailable"> = useUndoableChange(
		{ run, runtime: failingRuntime, update },
		{ describe: (row) => row.id },
	).removeResult;
	change.remove({ expectedVersion: 7, id: "first", removed: true }, { id: "first", removed: false });
	// @ts-expect-error Removal needs an expected version.
	change.remove({ id: "first", removed: true }, { id: "first", removed: false });
	// @ts-expect-error Undo retains the command's domain payload.
	change.remove({ expectedVersion: 7, id: "first", removed: true }, { id: 1, removed: false });
	// @ts-expect-error The runtime must supply the command's services.
	useUndoableChange({ run: missing, runtime, update }, { describe: () => "Removed" });
	// @ts-expect-error A versioned result is required.
	useUndoableChange({ run: (_input: Input) => Effect.void, runtime, update }, { describe: () => "Removed" });
	return { failure, notice, runtimeFailure };
}
