import { useField } from "@shivaedev/form/client/react.ts";
import { useCreate } from "#client/create.ts";
import type { NoticeClient } from "#test/notices/client.ts";
import { Fields } from "#test/notices/Fields.ts";

export function Form({ client }: { readonly client: NoticeClient }) {
	const save = useCreate({
		create: client.api.save.run,
		fields: Fields,
		initialValues: { title: "" },
		notices: { onSuccess: (savedTitle) => ({ message: `Saved ${savedTitle}` }) },
		runtime: client.runtime,
	});
	const title = useField(save.form, "title");
	const settledStatus = save.dirty ? "Unsaved" : "Saved";
	const status = save.saving ? "Saving" : settledStatus;
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
			{title.error !== undefined && <p role="alert">{title.error}</p>}
			<button disabled={save.saving} type="submit">
				Save note
			</button>
			<p role="status">{status}</p>
		</form>
	);
}
