import { Data, Effect, Layer, type Option, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCreate } from "#create.ts";
import { useEditor } from "#editor.ts";

const query = Atom.make(Effect.succeed({ id: 1, title: "Quarterly report" }));
const fields = Schema.Struct({ title: Schema.String });
const runtime = Atom.runtime(Layer.empty);
const saveTitle = (values: { readonly title: string }) =>
	values.title.length > 0 ? Effect.succeed({ id: 1, title: values.title }) : Effect.fail("Rejected" as const);

export const useEditorExample = () => {
	const editor = useEditor({
		fields,
		query,
		rejectField: (error) => (error === "Rejected" ? { field: "title", message: "Required" } : undefined),
		runtime,
		save: saveTitle,
		values: (row) => ({ title: row.title }),
	});
	const failure: Option.Option<"Rejected"> = editor.failure;
	const row: Option.Option<{ id: number; title: string }> = editor.query.data;
	const create = useCreate({
		create: saveTitle,
		fields,
		initialValues: { title: "" },
		// @ts-expect-error Field rejections name a declared field.
		rejectField: () => ({ field: "missing", message: "Unknown" }),
		runtime,
	});
	const created: Option.Option<{ id: number; title: string }> = create.created;
	return { created, failure, row, save: editor.save };
};

class NameRejected extends Data.TaggedError("NameRejected")<{ readonly field: "title"; readonly message: string }> {}
class StaleRejected extends Data.TaggedError("StaleRejected")<{ readonly field: "subtitle"; readonly message: string }> {}
const saveNamed = (values: { readonly title: string }) => Effect.fail(new NameRejected({ field: "title", message: values.title }));
const saveStale = (values: { readonly title: string }) => Effect.fail(new StaleRejected({ field: "subtitle", message: values.title }));

export const useRejectionExample = () => {
	const named = useCreate({ create: saveNamed, fields, initialValues: { title: "" }, runtime });
	// @ts-expect-error A tagged field rejection naming a field the form lacks needs an explicit rejectField.
	const stale = useCreate({ create: saveStale, fields, initialValues: { title: "" }, runtime });
	const mapped = useEditor({
		fields,
		query,
		rejectField: (error: StaleRejected) => ({ field: "title", message: error.message }),
		runtime,
		save: (values) => Effect.as(saveStale(values), { id: 1, title: values.title }),
		values: (row) => ({ title: row.title }),
	});
	// @ts-expect-error The editor applies the same constraint to its save command.
	const unmapped = useEditor({
		fields,
		query,
		runtime,
		save: (values) => Effect.as(saveStale(values), { id: 1, title: values.title }),
		values: (row) => ({ title: row.title }),
	});
	return { mapped, named, stale, unmapped };
};

const perField = { field: Schema.optionalKey(Schema.String), message: Schema.String };
class Conflict extends Schema.TaggedError<Conflict>()("Conflict", perField) {}
class TitleConflict extends Schema.TaggedError<TitleConflict>()("TitleConflict", {
	field: Schema.optionalKey(Schema.Literal("title")),
	message: Schema.String,
}) {}
class Described extends Schema.TaggedError<Described>()("Described", { message: Schema.String }) {}
const saveConflict = (values: { readonly title: string }) => Effect.fail(new Conflict({ message: values.title }));

export const useOptionalFieldExample = () => {
	// @ts-expect-error An optional field typed wider than the form's field names needs an explicit rejectField.
	const unmapped = useCreate({ create: saveConflict, fields, initialValues: { title: "" }, runtime });
	const mapped = useCreate({
		create: saveConflict,
		fields,
		initialValues: { title: "" },
		rejectField: (error) => (error.field === "title" ? { field: "title", message: error.message } : undefined),
		runtime,
	});
	const titled = useCreate({ create: () => Effect.fail(new TitleConflict({ message: "Taken" })), fields, initialValues: { title: "" }, runtime });
	const described = useCreate({ create: () => Effect.fail(new Described({ message: "Gone" })), fields, initialValues: { title: "" }, runtime });
	return { described, mapped, titled, unmapped };
};
