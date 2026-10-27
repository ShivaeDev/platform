import { useAtomRef, useAtomSet, useAtomValue } from "@effect/atom-react";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { DraftSession } from "#draftSession.ts";
import type { DraftStorage, PersistedDraftConfig } from "#persistence.ts";
import type { Encoded, FieldFailure, Fields, Form, Invalid, Name } from "#shape.ts";
export const DraftSessionContext = createContext<DraftSession | undefined>(undefined);
export interface BrowserDraftConfig extends Omit<PersistedDraftConfig, "storage"> {
	readonly storage?: () => DraftStorage;
}
function browserStorage(): DraftStorage {
	return globalThis.localStorage;
}
export function usePersistedDraft(config: BrowserDraftConfig): PersistedDraftConfig;
export function usePersistedDraft(config: BrowserDraftConfig | undefined): PersistedDraftConfig | undefined;
export function usePersistedDraft(config: BrowserDraftConfig | undefined): PersistedDraftConfig | undefined {
	const session = useContext(DraftSessionContext);
	return config ? { ...config, session: session ?? config.session, storage: config.storage ?? browserStorage } : undefined;
}
export interface Field<TFields extends Fields, TKey extends Name<TFields>> {
	readonly choices: readonly Encoded<TFields>[TKey][] | undefined;
	readonly error: string | undefined;
	readonly name: TKey;
	readonly onBlur: () => void;
	readonly onChange: (value: Encoded<TFields>[TKey]) => void;
	readonly value: Encoded<TFields>[TKey];
}
export function useField<TFields extends Fields, A, E, TRuntimeError, TKey extends Name<TFields>>(
	form: Form<TFields, A, E, TRuntimeError>,
	name: TKey,
): Field<TFields, TKey> {
	const value = useAtomRef(form.field(name));
	const error = useAtomValue(form.error(name));
	const onChange = useCallback((next: Encoded<TFields>[TKey]) => form.change(name, next), [form, name]);
	const onBlur = useCallback(() => form.blur(name), [form, name]);
	const choices = useMemo(() => form.choices(name), [form, name]);
	return { choices, error, name, onBlur, onChange, value };
}
export interface Submit<A, E> {
	readonly result: AsyncResult.AsyncResult<A, E>;
	readonly run: () => void;
	readonly submitting: boolean;
}
export function useSubmit<TFields extends Fields, A, E, TRuntimeError>(
	form: Form<TFields, A, E, TRuntimeError>,
): Submit<A, E | TRuntimeError | FieldFailure | Invalid> {
	const result = useAtomValue(form.submit);
	const set = useAtomSet(form.submit);
	const run = useCallback(() => set(), [set]);
	return { result, run, submitting: result.waiting };
}
export function useDirty<TFields extends Fields, A, E, TRuntimeError>(form: Form<TFields, A, E, TRuntimeError>): boolean {
	return useAtomValue(form.dirty);
}
