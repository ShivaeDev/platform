import { useState } from "react";
import { make } from "@shivaedev/effect-form/form.ts";
import { useField, usePersistedDraft } from "@shivaedev/effect-form/react.ts";
import { useCreate } from "#create.ts";
import type { ProbeProps } from "./createDraftFields.ts";
import { DraftFields, draftInitial, draftRuntime } from "./draftFields.ts";

export function CreateDraftProbe({ create, held }: ProbeProps) {
	held.created = useCreate({
		create,
		fields: DraftFields,
		initialValues: draftInitial,
		persistedDraft: { key: "create-draft" },
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
export function DirectDraftProbe({ create, held }: ProbeProps) {
	const persistedDraft = usePersistedDraft({ key: "direct-draft" });
	const [form] = useState(() => make(DraftFields, { initialValues: draftInitial, onSubmit: create, persistedDraft, runtime: draftRuntime }));
	held.form = form;
	const name = useField(form, "name");
	return <input name="name" onChange={(event) => name.onChange(event.target.value)} value={name.value} />;
}
