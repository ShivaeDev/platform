import { Option } from "effect";
import { useId } from "react";
import { useField } from "@shivaedev/form/react.ts";
import { useCreate } from "@shivaedev/react/client/create.ts";
import type { ContractClient } from "@shivaedev/contract/makeClient.ts";
import type { Notes } from "#generated/modules/notes/Notes.ts";
import { Button } from "#client/ui/button.tsx";
import { Input } from "#client/ui/input.tsx";

export function NoteCreate({ client }: { readonly client: ContractClient<typeof Notes> }) {
	const titleId = useId();
	const errorId = useId();
	const create = useCreate(client.create, { initialValues: { title: "" } });
	const title = useField(create.form, "title");
	const titleError = Boolean(title.error) && (
		<p className="text-destructive text-sm" id={errorId} role="alert">
			{title.error}
		</p>
	);
	const statusMessage = Option.isSome(create.created) ? `Added ${create.created.value.title}` : "Notes are saved to PostgreSQL.";
	return (
		<form
			className="space-y-3"
			onSubmit={(event) => {
				event.preventDefault();
				create.save();
			}}
		>
			<label className="block text-sm font-medium" htmlFor={titleId}>
				New note
			</label>
			<div className="flex flex-col gap-3 sm:flex-row">
				<Input
					aria-describedby={title.error ? errorId : undefined}
					aria-invalid={Boolean(title.error)}
					id={titleId}
					onBlur={title.onBlur}
					onChange={(event) => title.onChange(event.target.value)}
					placeholder="Something to remember"
					value={title.value}
				/>
				<Button disabled={create.saving} type="submit">
					{create.saving ? "Adding…" : "Add note"}
				</Button>
			</div>
			{titleError}
			<p aria-live="polite" className="text-muted-foreground text-sm">
				{statusMessage}
			</p>
		</form>
	);
}
