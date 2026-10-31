import { Effect, Layer, Option, Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { form } from "@shivaedev/form/form.ts";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AuthFailure, authAction, authCall } from "#client/authAction.ts";
import { AuthActionControl, AuthFormControl } from "./authControls.tsx";
import { clickButton, submitForm } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

type Attempt = "wrong password" | "rate limited" | "unknown code" | "missing code" | "offline" | "success" | "invalid email";
type Mode = "atom" | "Effect form";
interface State {
	mode?: Mode;
	submit?: Atom.Atom<AsyncResult.AsyncResult<string | null, unknown>>;
	view?: Rendered;
}

function response(attempt: Attempt, email: string) {
	if (attempt === "offline") {
		return Promise.reject(new Error("Connection refused"));
	}
	if (attempt === "success") {
		return Promise.resolve({ data: `Signed in as ${email}`, error: null });
	}
	const errors = {
		"invalid email": { code: "INVALID_EMAIL" },
		"missing code": { status: HttpStatus.fromLiteral("InternalServerError") },
		"rate limited": { status: HttpStatus.fromLiteral("TooManyRequests") },
		"unknown code": { code: "FUTURE_PROVIDER_ERROR" },
		"wrong password": { code: "INVALID_EMAIL_OR_PASSWORD" },
	};
	const error = errors[attempt];
	return Promise.resolve({ data: null, error });
}

function current(state: State) {
	if (!(state.view && state.submit && state.mode)) {
		throw new Error("No auth screen");
	}
	return { mode: state.mode, submit: state.submit, view: state.view };
}

export const authStories = storyKit(
	screenKit(
		"auth calls",
		(): State => ({}),
		(state, screen) => ({
			failureCause: () => {
				const { view, submit } = current(state);
				const failure = Option.getOrUndefined(AsyncResult.error(view.registry.get(submit)));
				return failure instanceof AuthFailure ? failure.cause : undefined;
			},
			shown: () => current(state).view.container.querySelector("output")?.textContent,
			submit: () =>
				screen.act("submit the sign-in attempt", async () => {
					const { view, submit, mode } = current(state);
					if (mode === "atom") {
						clickButton(view.container, "Sign in");
					} else {
						submitForm(view.container);
					}
					await Effect.runPromise(AtomRegistry.getResult(view.registry, submit, { suspendOnWaiting: true }).pipe(Effect.result));
				}),
		}),
	),
);

export function authAttempt(mode: Mode, attempt: Attempt) {
	return authStories.trait("screen", `${attempt} through the ${mode}`, function* ({ state, screen }) {
		function run({ email }: { email: string }, _signal: AbortSignal) {
			return response(attempt, email);
		}
		state.mode = mode;
		if (mode === "atom") {
			const action = authAction(run);
			state.submit = action;
			state.view = yield* screen.open(<AuthActionControl action={action} />);
		} else {
			const signIn = form(Schema.Struct({ email: Schema.String }), {
				initialValues: { email: "alice@example.com" },
				onSubmit: authCall(run),
				runtime: Atom.runtime(Layer.empty),
			});
			state.submit = signIn.submit;
			state.view = yield* screen.open(<AuthFormControl form={signIn} />);
		}
	});
}
