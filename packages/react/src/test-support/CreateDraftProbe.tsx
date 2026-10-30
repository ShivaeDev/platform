import { useState } from "react";
import { useField, usePersistedDraft } from "@shivaedev/form/client/react.ts";
import { form } from "@shivaedev/form/form.ts";
import { useCreate } from "#client/create.ts";
import type { ProbeProps } from "./createDraftFields.ts";
import { DraftFields, draftInitial, draftRuntime } from "./draftFields.ts";

export function CreateDraftProbe({ create, held, now }: ProbeProps) {
	held.created = useCreate({
		create,
		fields: DraftFields,
		initialValues: draftInitial,
		persistedDraft: { key: "create-draft", now },
		runtime: draftRuntime,
	});
	held.form = held.created.form;
	const name = useField(held.form, "name");
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				held.created?.save();
			}}
		>
			<input name="name" onChange={(event) => name.onChange(event.target.value)} value={name.value} />
			<button type="submit">Save</button>
		</form>
	);
}
export function DirectDraftProbe({ create, held, now }: ProbeProps) {
	const persistedDraft = usePersistedDraft({ key: "direct-draft", now });
	const [currentForm] = useState(() => form(DraftFields, { initialValues: draftInitial, onSubmit: create, persistedDraft, runtime: draftRuntime }));
	held.form = currentForm;
	const name = useField(currentForm, "name");
	return <input name="name" onChange={(event) => name.onChange(event.target.value)} value={name.value} />;
}
