import { useAtomMount, useAtomRef, useAtomValue } from "@effect/atom-react";
import type { FieldPath, ValueAt } from "#fieldPath.ts";
import type { Encoded, Fields, Form, Name, Path } from "#shape.ts";

export function useFieldAt<TFields extends Fields, A, E, TRuntimeError, const TPath extends Path<Name<TFields>> & FieldPath<Encoded<TFields>>>(
	form: Form<TFields, A, E, TRuntimeError>,
	path: TPath,
) {
	useAtomMount(form.dirty);
	const value = useAtomRef(form.fieldAt(path));
	const error = useAtomValue(form.errorAt(path));
	return {
		error,
		name: path.join("."),
		onBlur: () => form.blur(path[0]),
		onChange: (next: ValueAt<Encoded<TFields>, TPath>) => form.changeAt(path, next),
		value,
	};
}
