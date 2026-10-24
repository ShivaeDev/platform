import { type Effect, Equal, Option, type Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { useCallback, useState } from "react";
import { type BrowserDraftConfig, usePersistedDraft } from "@shivaedev/effect-form/client/react.ts";
import type { Decoded, Encoded, FieldFailure, Fields, Form, Services } from "@shivaedev/effect-form/shape.ts";
import type { AtomServices, FieldRejectionMapping } from "#fieldRejection.ts";
import { useSubmissionCallbacks } from "#internal/useSubmissionCallbacks.ts";
import { submission } from "#submission.ts";
import { type SaveState, useSaveState } from "./saveState.ts";
export type CreateConfig<TFields extends Fields, TCreated, TSaveError, R, TRuntimeError> = {
	readonly persistedDraft?: BrowserDraftConfig | undefined;
	readonly fields: Schema.Struct<TFields>;
	readonly initialValues: Encoded<TFields>;
	readonly create: (values: Decoded<TFields>) => Effect.Effect<TCreated, TSaveError, AtomServices<R>>;
	readonly runtime: Atom.AtomRuntime<Services<TFields, R>, TRuntimeError>;
} & FieldRejectionMapping<TFields, TSaveError>;
export interface Create<TFields extends Fields, TCreated, TSaveError, TRuntimeError> extends SaveState<TSaveError | TRuntimeError> {
	readonly created: Option.Option<TCreated>;
	readonly form: Form<TFields, TCreated, TSaveError | FieldFailure, TRuntimeError>;
}
function editedSince<TV extends object>(current: TV, submitted: TV | undefined): Readonly<Record<string, unknown>> {
	const before = new Map(Object.entries(submitted ?? current));
	return Object.fromEntries(Object.entries(current).filter(([name, value]) => !Equal.equals(value, before.get(name))));
}
export function useCreate<TFields extends Fields, TCreated, TSaveError, R, TRuntimeError>(
	config: CreateConfig<TFields, TCreated, TSaveError, R, TRuntimeError>,
): Create<TFields, TCreated, TSaveError, TRuntimeError> {
	const persistedDraft = usePersistedDraft(config.persistedDraft);
	const callbacks = useSubmissionCallbacks(config.fields, config.create, config.rejectField);
	function initialize() {
		const { fields, initialValues, runtime } = config;
		function makeSubmission() {
			return submission({ ...callbacks, fields, initialValues, persistedDraft, runtime });
		}
		return { baseline: initialValues, created: Option.none<TCreated>(), current: makeSubmission(), fields, fresh: makeSubmission, runtime };
	}
	const [held, hold] = useState(initialize);
	let entry = held;
	if (entry.fields !== config.fields || entry.runtime !== config.runtime) {
		entry = initialize();
		hold(entry);
	}
	const { baseline, created, current, fresh } = entry;
	const settled = useCallback(
		(value: TCreated) => {
			const next = fresh();
			next.form.values.set({ ...baseline, ...editedSince(current.form.values.value, current.submitted()) });
			hold({ ...entry, created: Option.some(value), current: next });
		},
		[entry, current, fresh, baseline],
	);
	return { ...useSaveState(current.form, settled), created, form: current.form };
}
