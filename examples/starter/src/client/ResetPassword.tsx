import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useId, useState } from "react";
import { useAction } from "@shivaedev/react/client/resultState.ts";
import { Button } from "#client/ui/button.tsx";
import { Input } from "#client/ui/input.tsx";
import type { AuthActions } from "./auth.ts";

export function ResetPassword({ auth, token }: { readonly auth: AuthActions; readonly token: string }) {
	const id = useId();
	const [newPassword, setNewPassword] = useState("");
	const action = useAction(auth.resetPassword);
	const success = AsyncResult.isSuccess(action.result) && !action.pending;
	const failureMessage = Option.isSome(AsyncResult.error(action.result)) && (
		<p role="alert">Could not reset password. Request a new link and try again.</p>
	);
	const content = success ? (
		<p role="status">
			Password changed. <a href="/sign-in">Sign in</a>
		</p>
	) : (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				action.dispatch({ newPassword, token });
			}}
		>
			<label htmlFor={id}>New password</label>
			<Input
				autoComplete="new-password"
				id={id}
				minLength={8}
				onChange={(event) => setNewPassword(event.target.value)}
				required
				type="password"
				value={newPassword}
			/>
			{failureMessage}
			<Button disabled={action.pending} type="submit">
				{action.pending ? "Please wait…" : "Change password"}
			</Button>
		</form>
	);
	return (
		<main className="mx-auto w-full max-w-md space-y-6 px-4 py-12">
			<h1 className="text-3xl font-semibold">Reset password</h1>
			{content}
		</main>
	);
}
