import { useField } from "@shivaedev/form/react.ts";
import { useCreate } from "#client/create.ts";
import type { NoticeClient } from "#test/notices/client.ts";

export function Form({ client }: { readonly client: NoticeClient }) {
	const save = useCreate(client.api.save, {
		initialValues: { title: "" },
		notices: { onSuccess: (savedTitle) => ({ message: `Saved ${savedTitle}` }) },
	});
	const title = useField(save.form, "title");
	const settledStatus = save.dirty ? "Unsaved" : "Saved";
	const status = save.saving ? "Saving" : settledStatus;
	const error = title.error !== undefined && <p role="alert">{title.error}</p>;
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				save.save();
			}}
		>
			<label>
				Title
				<input aria-invalid={title.error !== undefined} name="title" onChange={(event) => title.onChange(event.target.value)} value={title.value} />
			</label>
			{error}
			<button disabled={save.saving} type="submit">
				Save note
			</button>
			<p role="status">{status}</p>
		</form>
	);
}
