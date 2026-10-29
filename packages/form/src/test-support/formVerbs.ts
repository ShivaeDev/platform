import { inspect } from "node:util";
import { Deferred, Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { vi } from "vitest";
import { form } from "#form.ts";
import type { Encoded, Fields, Form, Name, Path } from "#shape.ts";
import type { FormEngine } from "./formEngine.ts";

export function formVerbs<TFields extends Fields, A, E, R, TRuntimeError>(
	state: FormEngine<TFields, A, E, R, TRuntimeError>,
	story: { tell: (line: string) => void },
) {
	function current() {
		if (!state.current) {
			throw new Error("The setup stage must create the form before its verbs run");
		}
		return state.current;
	}
	function read<T>(atom: Atom.Atom<T>): T {
		if (!state.mounted.has(atom)) {
			state.registry.mount(atom);
			state.mounted.add(atom);
		}
		return state.registry.get(atom);
	}
	function observe(path: string, atom: Atom.Atom<string | undefined>) {
		state.observed.set(path, atom);
		return read(atom);
	}
	const currentForm: Form<TFields, A, E, TRuntimeError> = {
		blur: (name) => {
			story.tell(`blur ${name}`);
			current().blur(name);
		},
		change: <TKey extends Name<TFields>>(name: TKey, value: Encoded<TFields>[TKey]) => {
			story.tell(`edit ${name}: ${inspect(value)}`);
			current().change(name, value);
		},
		choices: (name) => current().choices(name),
		get dirty() {
			return current().dirty;
		},
		error: (name) => {
			const atom = current().error(name);
			state.observed.set(name, atom);
			return atom;
		},
		errorAt: (path) => {
			const atom = current().errorAt(path);
			state.observed.set(JSON.stringify(path), atom);
			return atom;
		},
		field: (name) => current().field(name),
		receive: (values: Encoded<TFields>) => {
			story.tell(`receive ${inspect(values)}`);
			current().receive(values);
		},
		revert: () => {
			story.tell("revert to the server baseline");
			current().revert();
		},
		get submit() {
			return current().submit;
		},
		get submitting() {
			return current().submitting;
		},
		get values() {
			return current().values;
		},
	};
	function submit() {
		story.tell("submit the current input");
		state.registry.set(current().submit, undefined);
	}
	function rewriteStoredDraft(line: string, change: (record: Record<string, unknown>) => Record<string, unknown>) {
		story.tell(line);
		const { key } = state.storage.config;
		const raw = state.storage.saved.get(key);
		if (raw === undefined) {
			throw new Error(`No draft is stored under ${key}`);
		}
		state.storage.saved.set(key, JSON.stringify(change(JSON.parse(raw))));
	}
	function result() {
		return AtomRegistry.getResult(state.registry, current().submit, { suspendOnWaiting: true });
	}
	return {
		answerCheck: state.checkGate.answer,
		checked: state.checked,
		checkStarted: state.checkGate.started,
		dirty: () => read(current().dirty),
		draftState: () => ({ dirty: read(current().dirty), saved: Object.fromEntries(state.storage.saved), values: current().values.value }),
		dropSession: () => {
			story.tell("end the editing session");
			state.session.drop();
		},
		errorAt: (path: Path<Name<TFields>>) => observe(JSON.stringify(path), current().errorAt(path)),
		errors: (name: Name<TFields>) => observe(name, current().error(name)),
		eventually: (assertion: () => void) => Effect.promise(() => vi.waitFor(assertion)),
		finishSave: () => {
			story.tell("the server answers the save");
			return Deferred.succeed(state.release, undefined);
		},
		form: currentForm,
		read,
		reject: () => Effect.flip(result()),
		reload: (initialValues: Encoded<TFields>) => {
			story.tell(`reload with server values ${JSON.stringify(initialValues)}`);
			state.current = form(state.schema, { ...state.config, initialValues });
			return currentForm;
		},
		result,
		saved: state.storage.saved,
		storedDraftAgesBy: (ms: number) =>
			rewriteStoredDraft(`the stored draft ages by ${ms} ms`, (record) => ({ ...record, updatedAt: Number(record.updatedAt) - ms })),
		storedDraftBytes: () => new TextEncoder().encode(state.storage.saved.get(state.storage.config.key) ?? "").byteLength,
		storedDraftPaddedTo: (bytes: number) =>
			rewriteStoredDraft(`the stored draft is padded to ${bytes} bytes`, (record) => {
				const unpadded = JSON.stringify({ ...record, padding: "" }).length;
				return { ...record, padding: "x".repeat(bytes - unpadded) };
			}),
		submissions: state.submissions,
		submit,
		waitForSave: () => Deferred.await(state.started),
	};
}
