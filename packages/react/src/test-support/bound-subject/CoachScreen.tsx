import { Option } from "effect";
import { forSubject } from "@shivaedev/contract/forSubject.ts";
import { useField } from "@shivaedev/form/react.ts";
import { useCreate } from "#client/create.ts";
import { useAction, useQuery } from "#client/resultState.ts";
import type { JournalClient } from "#test/bound-subject/connect.ts";

// The screen binds its client during render, as a route that reaches its client by closure does, so each render binds it again.
export function CoachScreen({ client }: { readonly client: JournalClient }) {
	const dana = forSubject(client.api, "dana").journal;
	const own = useQuery(client.api.journal.entries.query());
	const danas = useQuery(dana.entries.query());
	const quickEntry = useAction(dana.write, { failures: { NotYourClient: "message" } });
	const create = useCreate(dana.write, { failures: { NotYourClient: "message" }, initialValues: { entry: "" } });
	const entry = useField(create.form, "entry");
	return (
		<section>
			<output data-journal="own">{Option.getOrElse(own.data, () => "")}</output>
			<output data-journal="dana">{Option.getOrElse(danas.data, () => "")}</output>
			<button disabled={quickEntry.pending} onClick={() => quickEntry.dispatch({ entry: "Ran 5k" })} type="button">
				Log Ran 5k
			</button>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					create.save();
				}}
			>
				<input name="entry" onChange={(event) => entry.onChange(event.target.value)} value={entry.value} />
				<button type="submit">Write</button>
			</form>
		</section>
	);
}
