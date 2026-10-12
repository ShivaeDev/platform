import { RegistryContext } from "@effect/atom-react";
import { useContext } from "react";
import { useField } from "@shivaedev/effect-form/react.ts";
import { useEditor } from "#editor.ts";
import { DraftFields, draftRuntime, type ScreenProps, type ViewEditor } from "./draftFields.ts";

export function DraftScreen({ held, persistedDraft, query, save }: ScreenProps) {
	held.registry = useContext(RegistryContext);
	const editor = useEditor({ fields: DraftFields, persistedDraft, query, runtime: draftRuntime, save, values: (row) => row });
	held.current = editor;
	return editor.form ? <DraftInputs editor={editor} /> : null;
}
export function DraftInputs({ editor }: { readonly editor: ViewEditor }) {
	if (!editor.form) {
		throw new Error("Expected an editor form");
	}
	const name = useField(editor.form, "name");
	const quantity = useField(editor.form, "quantity");
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				editor.save();
			}}
		>
			<label>
				Name
				<input onChange={(event) => name.onChange(event.target.value)} value={name.value} />
			</label>
			<label>
				Quantity
				<input onChange={(event) => quantity.onChange(event.target.value)} value={quantity.value} />
			</label>
			<button disabled={editor.saving} type="submit">
				Save
			</button>
			<output>{editor.dirty ? "Unsaved" : "Saved"}</output>
		</form>
	);
}
