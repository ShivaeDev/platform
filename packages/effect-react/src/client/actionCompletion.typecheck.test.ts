import { type Cause, Context, Effect, Layer, type Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useAction } from "./resultState.ts";

class Titles extends Context.Service<Titles, { readonly prefix: string }>()("test/Titles") {}
class Missing extends Context.Service<Missing, { readonly value: number }>()("test/Missing") {}
const runtime = Atom.runtime(Layer.succeed(Titles, { prefix: "Report" }));
const failingRuntime = Atom.runtime(Layer.effect(Titles, Effect.fail("RuntimeUnavailable" as const)));
const run = Effect.fnUntraced(function* (input: { readonly title: string }) {
	const titles = yield* Titles;
	if (!input.title) {
		return yield* Effect.fail("InvalidTitle" as const);
	}
	return { title: `${titles.prefix}: ${input.title}` };
});

export function useCompletionTypes() {
	const action = useAction(runtime, run, {
		onFailure: (error, input) => {
			const failure: "InvalidTitle" = error;
			const title: string = input.title;
			void [failure, title];
		},
		onSuccess: (value, input) => {
			const title: string = value.title;
			const original: string = input.title;
			void [title, original];
		},
	});
	const data: Option.Option<{ title: string }> = action.data;
	const cause: Option.Option<Cause.Cause<"InvalidTitle">> = action.cause;
	const dispatch: (input: { readonly title: string }) => void = action.dispatch;
	const runtimeFailure: Option.Option<Cause.Cause<"InvalidTitle" | "RuntimeUnavailable">> = useAction(failingRuntime, run).cause;
	// @ts-expect-error Input is inferred from the command.
	action.dispatch({ title: 123 });
	// @ts-expect-error The native runtime must provide the command's requirements.
	useAction(runtime, () => Missing.asEffect());
	useAction(runtime, run, {
		// @ts-expect-error Callbacks cannot change the command's success type.
		onSuccess: (value: number) => {
			void value;
		},
	});
	useAction(runtime, run, {
		// @ts-expect-error Callbacks cannot change the command's failure type.
		onFailure: (error: number) => {
			void error;
		},
	});
	useAction(runtime, run, {
		notices: {
			onFailure: (error, input) => ({ message: `${input.title}: ${error}` }),
			onSuccess: (value, input) => ({ action: { label: "Undo", run: run(input) }, message: value.title }),
		},
	});
	useAction(runtime, run, {
		notices: {
			// @ts-expect-error Undo must use services provided by the operation's runtime.
			onSuccess: () => ({ action: { label: "Undo", run: Missing.asEffect() }, message: "Saved" }),
		},
	});
	return { cause, data, dispatch, runtimeFailure };
}
