import type { Decoded, Encoded, FieldFailure, Fields, Form, Services } from "@shivaedev/effect-form";
import { type Effect, Option, type Schema } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useEffect, useState } from "react";
import type { AtomServices, FieldRejectionMapping } from "./field-rejection.ts";
import { type QueryState, useQuery } from "./result-state.ts";
import { type SaveState, useSaveState } from "./save-state.ts";
import { submission } from "./submission.ts";

export type EditorConfig<F extends Fields, Row, QE, SE, R, ER> = {
	readonly query: Atom.Atom<AsyncResult.AsyncResult<Row, QE>>;
	readonly fields: Schema.Struct<F>;
	readonly values: (row: Row) => Encoded<F>;
	readonly save: (values: Decoded<F>) => Effect.Effect<Row, SE, AtomServices<R>>;
	readonly runtime: Atom.AtomRuntime<Services<F, R>, ER>;
} & FieldRejectionMapping<F, SE>;

export interface Editor<F extends Fields, Row, QE, SE, ER> extends SaveState<SE | ER> {
	readonly query: QueryState<Row, QE>;
	readonly form: Form<F, Row, SE | FieldFailure, ER> | undefined;
}

interface Held<F extends Fields, Row, SE, ER> {
	readonly query: Atom.Atom<unknown>;
	readonly form: Form<F, Row, SE | FieldFailure, ER>;
	readonly values: (row: Row) => Encoded<F>;
}

export const useEditor = <F extends Fields, Row, QE, SE, R, ER>(config: EditorConfig<F, Row, QE, SE, R, ER>): Editor<F, Row, QE, SE, ER> => {
	const query = useQuery(config.query);
	const row = Option.getOrUndefined(query.data);
	const [held, hold] = useState<Held<F, Row, SE, ER> | undefined>(undefined);
	let current = held?.query === config.query ? held : undefined;
	if (current === undefined && row !== undefined) {
		current = {
			query: config.query,
			values: config.values,
			form: submission({
				fields: config.fields,
				initialValues: config.values(row),
				runtime: config.runtime,
				save: config.save,
				rejectField: config.rejectField,
			}).form,
		};
		hold(current);
	}
	const form = current?.form;
	const values = current?.values;
	useEffect(() => {
		if (form && values && row !== undefined) form.receive(values(row));
	}, [form, values, row]);
	const settled = useCallback((saved: Row) => (form && values ? form.receive(values(saved)) : undefined), [form, values]);
	return { ...useSaveState(form, settled), query, form };
};
