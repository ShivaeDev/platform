import { Option } from "effect";
import { useEffect, useState } from "react";
import { useCreate } from "#client/create.ts";
import type { InvoiceLine, makeInvoiceLineServer } from "./backend.ts";
import { InvoiceLineDraft, InvoiceLineForm, values } from "./Screen.ts";

export function InvoiceLineOneShot({
	opening,
	server: { api, runtime },
	onSaved,
}: {
	readonly opening: InvoiceLine;
	readonly server: ReturnType<typeof makeInvoiceLineServer>;
	readonly onSaved: (line: InvoiceLine) => void;
}) {
	const [original] = useState(opening);
	const edit = useCreate({
		create: (draft) => api.save.run({ expectedVersion: original.version, id: original.id, ...draft }),
		fields: InvoiceLineDraft,
		initialValues: values(original),
		runtime,
	});
	useEffect(() => {
		if (Option.isSome(edit.created)) {
			onSaved(edit.created.value);
		}
	}, [edit.created, onSaved]);
	const conflict = Option.isSome(edit.failure) && edit.failure.value._tag === "Conflict";
	return <InvoiceLineForm editor={edit} failureMessage={conflict ? "This line changed. Reopen it to use the latest version." : "Could not save"} />;
}

export function OneShotScreen({ opening, server }: { readonly opening: InvoiceLine; readonly server: ReturnType<typeof makeInvoiceLineServer> }) {
	const [saved, setSaved] = useState<InvoiceLine>();
	return (
		<>
			<InvoiceLineOneShot onSaved={setSaved} opening={opening} server={server} />
			{saved ? (
				<output>
					Completed {saved.id}: {saved.name} / {saved.quantity} (version {saved.version})
				</output>
			) : null}
		</>
	);
}
