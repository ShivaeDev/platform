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
} from "#test/formHookFixtures.ts";

export function useEditorExample() {
	const editor = useEditor(
		{ run: saveTitle, runtime },
		{
			fields: Title,
			query,
			rejectField: (error) => (error === "Rejected" ? { field: "title", message: "Required" } : undefined),
			values: (record) => ({ title: record.title }),
		},
	);
	const create = useCreate(
		{ run: saveTitle, runtime },
		{ fields: Title, initialValues: { title: "" }, rejectField: () => ({ field: "title" as const, message: "Unknown" }) },
	);
	return { create, editor };
}

export function useRejectionExample() {
	const named = useCreate({ run: saveNamed, runtime }, { fields: Title, initialValues: { title: "" } });
	const mapped = useEditor(
		{ run: (values: typeof Title.Type) => Effect.as(saveStale(values), { id: 1, title: values.title }), runtime },
		{
			fields: Title,
			query,
			rejectField: (error: StaleRejected) => ({ field: "title", message: error.message }),
			values: (record) => ({ title: record.title }),
		},
	);
	return { mapped, named };
}

export function useOptionalFieldExample() {
	const mapped = useCreate(
		{ run: saveConflict, runtime },
		{
			fields: Title,
			initialValues: { title: "" },
			rejectField: (error) => (error.field === "title" ? { field: "title", message: error.message } : undefined),
		},
	);
	const titled = useCreate(
		{ run: () => Effect.fail(new TitleConflict({ message: "Taken" })), runtime },
		{ fields: Title, initialValues: { title: "" } },
	);
	const described = useCreate(
		{ run: () => Effect.fail(new Described({ message: "Gone" })), runtime },
		{ fields: Title, initialValues: { title: "" } },
	);
	return { described, mapped, titled };
}
