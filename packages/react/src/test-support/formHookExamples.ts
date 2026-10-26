import { Effect } from "effect";
import { useCreate } from "#client/create.ts";
import { useEditor } from "#client/editor.ts";
import {
	Described,
	query,
	runtime,
	type StaleRejected,
	saveConflict,
	saveNamed,
	saveStale,
	saveTitle,
	Title,
	TitleConflict,
} from "./formHookFixtures.ts";

export function useEditorExample() {
	const editor = useEditor({
		fields: Title,
		query,
		rejectField: (error) => (error === "Rejected" ? { field: "title", message: "Required" } : undefined),
		runtime,
		save: saveTitle,
		values: (record) => ({ title: record.title }),
	});
	const create = useCreate({
		create: saveTitle,
		fields: Title,
		initialValues: { title: "" },
		rejectField: () => ({ field: "title", message: "Unknown" }),
		runtime,
	});
	return { create, editor };
}

export function useRejectionExample() {
	const named = useCreate({ create: saveNamed, fields: Title, initialValues: { title: "" }, runtime });
	const mapped = useEditor({
		fields: Title,
		query,
		rejectField: (error: StaleRejected) => ({ field: "title", message: error.message }),
		runtime,
		save: (values) => Effect.as(saveStale(values), { id: 1, title: values.title }),
		values: (record) => ({ title: record.title }),
	});
	return { mapped, named };
}

export function useOptionalFieldExample() {
	const mapped = useCreate({
		create: saveConflict,
		fields: Title,
		initialValues: { title: "" },
		rejectField: (error) => (error.field === "title" ? { field: "title", message: error.message } : undefined),
		runtime,
	});
	const titled = useCreate({
		create: () => Effect.fail(new TitleConflict({ message: "Taken" })),
		fields: Title,
		initialValues: { title: "" },
		runtime,
	});
	const described = useCreate({
		create: () => Effect.fail(new Described({ message: "Gone" })),
		fields: Title,
		initialValues: { title: "" },
		runtime,
	});
	return { described, mapped, titled };
}
