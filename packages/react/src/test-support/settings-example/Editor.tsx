import { useAtomMount } from "@effect/atom-react";
import { Option, Schema } from "effect";
import { useId } from "react";
import { useField } from "@shivaedev/form/client/react.ts";
import { useEditor } from "#client/editor.ts";
import { type EntitySettings, Settings } from "./contract.ts";
import type { makeClient } from "./makeClient.ts";

const Draft = Schema.Struct({
	...Settings.fields,
	pageSize: Schema.NumberFromString,
});
function values(row: typeof EntitySettings.Type) {
	return { pageSize: String(row.pageSize), title: row.title };
}
function useSettingsEditor(client: ReturnType<typeof makeClient>) {
	useAtomMount(client.connection);
	return useEditor({
		fields: Draft,
		query: client.query,
		runtime: client.Client.runtime,
		save: (input) => client.api.save.run({ entityId: client.entityId, ...input }),
		values,
	});
}
function Fields({ form }: { readonly form: NonNullable<ReturnType<typeof useSettingsEditor>["form"]> }) {
	const errorId = useId();
	const title = useField(form, "title");
	const pageSize = useField(form, "pageSize");
	return (
		<fieldset>
			<label>
				Title
				<input name="title" onChange={(event) => title.onChange(event.target.value)} value={title.value} />
			</label>
			<label>
				Rows per page
				<input
					aria-describedby={errorId}
					aria-invalid={pageSize.error !== undefined}
					name="pageSize"
					onChange={(event) => pageSize.onChange(event.target.value)}
					value={pageSize.value}
				/>
			</label>
			<span id={errorId} role="alert">
				{pageSize.error}
			</span>
		</fieldset>
	);
}
export function Editor({ client }: { readonly client: ReturnType<typeof makeClient> }) {
	const editor = useSettingsEditor(client);
	const row = Option.getOrUndefined(editor.query.data);
	const draftStatus = editor.dirty ? "Unsaved changes" : "Saved";
	const status = editor.saving ? "Saving" : draftStatus;
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				editor.save();
			}}
		>
			<output>{row !== undefined && `${row.title} / ${row.pageSize}`}</output>
			{editor.form !== undefined && <Fields form={editor.form} />}
			<button disabled={!editor.form || editor.saving} type="submit">
				Save
			</button>
			<span role="status">{status}</span>
		</form>
	);
}
