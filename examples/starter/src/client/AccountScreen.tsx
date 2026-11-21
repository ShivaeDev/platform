import { Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { useId, useState } from "react";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import type { Account } from "@shivaedev/identity/generated/Account.ts";
import { useAction } from "@shivaedev/react/client/resultState.ts";
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
					Back to notes
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
	const [password, setPassword] = useState("");
	// The dialog says why the password was refused, so the notice host stays quiet for those two.
	const deletion = useAction(client.delete, { failures: { BadRequest: "silent", PreconditionFailed: "silent" }, onSuccess: onDeleted });
	const refusal = AsyncResult.error(deletion.result).pipe(
		Option.filter((error) => error._tag === "BadRequest" || error._tag === "PreconditionFailed"),
		Option.map((error) => error.message),
	);
	const refusalMessage = !deletion.pending && Option.isSome(refusal) && (
		<p className="text-destructive text-sm" role="alert">
			{refusal.value}
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
						deletion.dispatch({ password });
					}}
				>
					<DialogHeader>
						<DialogTitle>Delete your account?</DialogTitle>
						<DialogDescription>Enter your password to confirm. This cannot be undone.</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<label htmlFor={passwordId}>Password</label>
						<Input
							autoComplete="current-password"
							id={passwordId}
							onChange={(event) => setPassword(event.target.value)}
							type="password"
							value={password}
						/>
					</div>
					{refusalMessage}
					<DialogFooter>
						<Button disabled={deletion.pending} type="submit" variant="destructive">
							{deletion.pending ? "Deleting…" : "Delete my account"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
