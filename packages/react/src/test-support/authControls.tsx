import { Option, type Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { useSubmit } from "@shivaedev/form/client/react.ts";
import type { Form } from "@shivaedev/form/shape.ts";
import { AuthFailure } from "#client/authAction.ts";
import { useAction } from "#client/resultState.ts";

export function AuthActionControl({ action }: { readonly action: Atom.AtomResultFn<{ email: string }, string | null, AuthFailure> }) {
	const state = useAction(action);
	return (
		<>
			<button onClick={() => state.dispatch({ email: "alice@example.com" })} type="button">
				Sign in
			</button>
			<AuthAnswer result={state.result} />
		</>
	);
}

export function AuthFormControl({ form }: { readonly form: Form<{ email: typeof Schema.String }, string | null, AuthFailure, never> }) {
	const submit = useSubmit(form);
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				submit.run();
			}}
		>
			<button type="submit">Sign in</button>
			<AuthAnswer result={submit.result} />
		</form>
	);
}

function AuthAnswer({ result }: { readonly result: AsyncResult.AsyncResult<string | null, unknown> }) {
	const failure = Option.getOrUndefined(AsyncResult.error(result));
	const code = failure instanceof AuthFailure ? failure.code : "";
	const data = AsyncResult.isSuccess(result) ? result.value : "";
	return <output>{code || data}</output>;
}
