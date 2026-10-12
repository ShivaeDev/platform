import { useId, useState } from "react";
import type { AuthActions } from "./auth.ts";
import { Button } from "./Button.tsx";
import { Input } from "./Input.tsx";

export function LoginScreen({ auth, onAuthenticated }: { readonly auth: AuthActions; readonly onAuthenticated: () => void }) {
	const id = useId();
	const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
	const [credentials, setCredentials] = useState({ email: "", name: "", password: "" });
	const [pending, setPending] = useState(false);
	const [failure, setFailure] = useState<string>();
	const submitLabel = mode === "sign-in" ? "Sign in" : "Create account";
	const buttonLabel = pending ? "Please wait…" : submitLabel;
	async function submit() {
		setPending(true);
		setFailure(undefined);
		try {
			const error = await auth.submit(mode, credentials);
			if (error === undefined) {
				onAuthenticated();
			} else {
				setFailure(error);
			}
		} catch {
			setFailure("Could not reach authentication. Try again.");
		} finally {
			setPending(false);
		}
	}
	return (
		<main className="mx-auto w-full max-w-md space-y-6 px-4 py-12">
			<h1 className="font-semibold text-3xl">{mode === "sign-in" ? "Sign in" : "Create an account"}</h1>
			<p className="text-muted-foreground">Sign in to view and add your notes.</p>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					void submit();
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
				{failure !== undefined && (
					<p className="text-destructive" role="alert">
						{failure}
					</p>
				)}
				<Button disabled={pending} type="submit">
					{buttonLabel}
				</Button>
			</form>
			<Button
				disabled={pending}
				onClick={() => {
					setMode(mode === "sign-in" ? "sign-up" : "sign-in");
					setFailure(undefined);
				}}
				variant="outline"
			>
				{mode === "sign-in" ? "Create an account" : "Use an existing account"}
			</Button>
		</main>
	);
}
