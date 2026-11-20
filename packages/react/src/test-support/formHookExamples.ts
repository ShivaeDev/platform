import { Effect } from "effect";
import type { Conflict } from "@shivaedev/errors/taxonomy.ts";
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

function onTitle(error: StaleRejected) {
	return { field: "title" as const, message: error.message };
}
function onConflict(error: Conflict) {
	return error.field === "title" ? { field: "title" as const, message: error.message } : { message: error.message };
}

export function useEditorExample() {
	const editor = useEditor(
		{ run: saveTitle, runtime },
		{
			fields: Title,
			query,
			values: (record) => ({ title: record.title }),
		},
	);
	const create = useCreate({ run: saveTitle, runtime }, { fields: Title, initialValues: { title: "" } });
	return { create, editor };
}

export function useRejectionExample() {
	const named = useCreate({ run: saveNamed, runtime }, { fields: Title, initialValues: { title: "" } });
	const mapped = useEditor(
		{ run: (values: typeof Title.Type) => Effect.as(saveStale(values), { id: 1, title: values.title }), runtime },
		{
			failures: { StaleRejected: onTitle },
			fields: Title,
			query,
			values: (record) => ({ title: record.title }),
		},
	);
	return { mapped, named };
}

export function useOptionalFieldExample() {
	const mapped = useCreate(
		{ run: saveConflict, runtime },
		{
			failures: { Conflict: onConflict },
			fields: Title,
			initialValues: { title: "" },
		},
	);
	const titled = useCreate(
		{ run: () => Effect.fail(new TitleConflict({ message: "Taken" })), runtime },
		{ failures: { TitleConflict: "message" }, fields: Title, initialValues: { title: "" } },
	);
	const described = useCreate(
		{ run: () => Effect.fail(new Described({ message: "Gone" })), runtime },
		{ failures: { Described: "message" }, fields: Title, initialValues: { title: "" } },
	);
	return { described, mapped, titled };
}
