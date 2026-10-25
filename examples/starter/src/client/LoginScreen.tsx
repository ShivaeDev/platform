import { RegistryContext } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useEffect, useId, useState } from "react";
import { useAction } from "@shivaedev/effect-react/client/resultState.ts";
import { Button } from "#client/ui/button.tsx";
import { Input } from "#client/ui/input.tsx";
import type { AuthActions } from "./auth.ts";

export function LoginScreen({ auth, onAuthenticated }: { readonly auth: AuthActions; readonly onAuthenticated: () => void }) {
	const id = useId();
	const registry = useContext(RegistryContext);
	const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
	const [credentials, setCredentials] = useState({ email: "", name: "", password: "" });
	const action = useAction(auth.submit);
	const failure = AsyncResult.error(action.result);
	useEffect(() => {
		if (AsyncResult.isSuccess(action.result) && !action.pending) {
			onAuthenticated();
		}
	}, [action.result, action.pending, onAuthenticated]);
	const submitLabel = mode === "sign-in" ? "Sign in" : "Create account";
	const buttonLabel = action.pending ? "Please wait…" : submitLabel;
	return (
		<main className="mx-auto w-full max-w-md space-y-6 px-4 py-12">
			<h1 className="font-semibold text-3xl">{mode === "sign-in" ? "Sign in" : "Create an account"}</h1>
			<p className="text-muted-foreground">Sign in to your app.</p>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					action.dispatch({ credentials, mode });
				}}
			>
				{mode === "sign-up" && (
					<div className="space-y-2">
						<label htmlFor={`${id}-name`}>Name</label>
						<Input
							autoComplete="name"
							id={`${id}-name`}
							onChange={(event) => setCredentials({ ...credentials, name: event.target.value })}
							required
							value={credentials.name}
						/>
					</div>
				)}
				<div className="space-y-2">
					<label htmlFor={`${id}-email`}>Email</label>
					<Input
						autoComplete="email"
						id={`${id}-email`}
						onChange={(event) => setCredentials({ ...credentials, email: event.target.value })}
						required
						type="email"
						value={credentials.email}
					/>
				</div>
				<div className="space-y-2">
					<label htmlFor={`${id}-password`}>Password</label>
					<Input
						autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
						id={`${id}-password`}
						minLength={8}
						onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
						required
						type="password"
						value={credentials.password}
					/>
				</div>
				{!action.pending && Option.isSome(failure) && (
					<p className="text-destructive" role="alert">
						{"_tag" in failure.value ? "Could not reach authentication. Try again." : (failure.value.message ?? "Authentication failed. Try again.")}
					</p>
				)}
				<Button disabled={action.pending} type="submit">
					{buttonLabel}
				</Button>
			</form>
			<Button
				disabled={action.pending}
				onClick={() => {
					setMode(mode === "sign-in" ? "sign-up" : "sign-in");
					registry.set(auth.submit, Atom.Reset);
				}}
				variant="outline"
			>
				{mode === "sign-in" ? "Create an account" : "Use an existing account"}
			</Button>
		</main>
	);
}
