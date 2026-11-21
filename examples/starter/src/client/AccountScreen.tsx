import { Option } from "effect";
import { useEffect, useEffectEvent, useId } from "react";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import { useField } from "@shivaedev/form/react.ts";
import type { Account } from "@shivaedev/identity/generated/Account.ts";
import { useCreate } from "@shivaedev/react/client/create.ts";
import { Button } from "#client/ui/button.tsx";
import { Card, CardContent } from "#client/ui/card.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "#client/ui/dialog.tsx";
import { Input } from "#client/ui/input.tsx";

export function AccountScreen({ client, onDeleted }: { readonly client: ContractClient<typeof Account>; readonly onDeleted: () => void }) {
	return (
		<main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-12 sm:px-6">
			<header className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
				<a className="inline-block text-sm underline" href="/">
					Back to the app
				</a>
			</header>
			<section aria-label="Delete account">
				<Card>
					<CardContent className="space-y-3">
						<h2 className="text-lg font-semibold">Delete account</h2>
						<p className="text-muted-foreground text-sm">Your account and everything you saved are removed for good.</p>
						<DeleteAccount client={client} onDeleted={onDeleted} />
					</CardContent>
				</Card>
			</section>
		</main>
	);
}

function DeleteAccount({ client, onDeleted }: { readonly client: ContractClient<typeof Account>; readonly onDeleted: () => void }) {
	const passwordId = useId();
	const errorId = useId();
	const deletion = useCreate(client.delete, { initialValues: { password: "" } });
	const password = useField(deletion.form, "password");
	const deleted = useEffectEvent(onDeleted);
	useEffect(() => {
		if (Option.isSome(deletion.created)) {
			deleted();
		}
	}, [deletion.created]);
	const passwordError = Boolean(password.error) && (
		<p className="text-destructive text-sm" id={errorId} role="alert">
			{password.error}
		</p>
	);
	return (
		<Dialog>
			<DialogTrigger render={<Button variant="destructive" />}>Delete account</DialogTrigger>
			<DialogContent>
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						deletion.save();
					}}
				>
					<DialogHeader>
						<DialogTitle>Delete your account?</DialogTitle>
						<DialogDescription>Enter your password to confirm. This cannot be undone.</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<label htmlFor={passwordId}>Password</label>
						<Input
							aria-describedby={password.error ? errorId : undefined}
							aria-invalid={Boolean(password.error)}
							autoComplete="current-password"
							id={passwordId}
							onBlur={password.onBlur}
							onChange={(event) => password.onChange(event.target.value)}
							type="password"
							value={password.value}
						/>
					</div>
					{passwordError}
					<DialogFooter>
						<Button disabled={deletion.saving} type="submit" variant="destructive">
							{deletion.saving ? "Deleting…" : "Delete my account"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
