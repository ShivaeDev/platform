import { type Cause, Layer, type Option } from "effect";
import type { SecureRandom } from "effect/crypto";
import * as Atom from "effect/reactivity/Atom";
import { useClock } from "./useClock.ts";
import { useNewId } from "./useNewId.ts";
import { usePromiseAction } from "./usePromiseAction.ts";

export function useHandlerTypes(runtime: Atom.AtomRuntime<SecureRandom.SecureRandom>) {
	const id: string = useNewId(runtime)();
	const time: number = useClock(runtime)();
	const action = usePromiseAction(() => Promise.resolve(42), { catch: (cause) => ({ _tag: "ClipboardDenied" as const, cause }) });
	const data: Option.Option<number> = action.data;
	const failure: Option.Option<Cause.Cause<{ readonly _tag: "ClipboardDenied"; readonly cause: unknown }>> = action.cause;
	const unknown: Option.Option<Cause.Cause<Cause.UnknownError>> = usePromiseAction(() => Promise.resolve()).cause;
	action.dispatch();
	// @ts-expect-error Promise callbacks take no dispatch input.
	action.dispatch("text");
	// @ts-expect-error The supplied runtime must provide SecureRandom.
	useNewId(Atom.runtime(Layer.empty));
	// @ts-expect-error The default error is UnknownError, not the promise's rejection type.
	const unwrapped: Option.Option<Cause.Cause<string>> = usePromiseAction(() => Promise.reject(new Error("denied"))).cause;
	return { data, failure, id, time, unknown, unwrapped };
}
