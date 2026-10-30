import { inspect } from "node:util";
import { Deferred, Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { form } from "#form.ts";
import { type Encoded, FieldFailure, type Fields, Invalid, type Name, type Path } from "#shape.ts";
import type { draftStorage } from "./draftStorage.ts";
import type { FormEngine } from "./formEngine.ts";

export type FormDriver<TFields extends Fields, A, E, R, TRuntimeError, TSupport> = ReturnType<
	typeof formDriver<TFields, A, E, R, TRuntimeError, TSupport>
>;

export function formDriver<TFields extends Fields, A, E, R, TRuntimeError, TSupport>(
	engine: FormEngine<TFields, A, E, R, TRuntimeError, TSupport>,
	tell: (line: string) => void,
) {
	function current() {
		if (engine.current === undefined) {
			throw new Error("The form opens after its configuration traits, before the story acts on it");
		}
		return engine.current;
	}
	function read<T>(atom: Atom.Atom<T>): T {
		if (!engine.mounted.has(atom)) {
			engine.registry.mount(atom);
			engine.mounted.add(atom);
		}
		return engine.registry.get(atom);
	}
	function result() {
		return AtomRegistry.getResult(engine.registry, current().submit, { suspendOnWaiting: true });
	}
	function open(initialValues: Encoded<TFields>) {
		engine.current = form(engine.schema, { ...engine.config, initialValues });
		read(engine.current.dirty);
		engine.opened(engine.current, read);
		return engine.current;
	}
	function held() {
		if (engine.held === undefined) {
			throw new Error("No save is held; start the story with a save in flight");
		}
		return engine.held;
	}
	return {
		change: <TKey extends Name<TFields>>(name: TKey, value: Encoded<TFields>[TKey]) => {
			tell(`enter ${inspect(value)} as the ${name}`);
			current().change(name, value);
		},
		current,
		engine,
		finishSave: () => {
			tell("the server answers the held save");
			return Deferred.succeed(held().release, undefined).pipe(Effect.andThen(Effect.exit(result())), Effect.asVoid);
		},
		holdNextSave: () => {
			engine.held = { armed: true, arrived: Deferred.makeUnsafe(), release: Deferred.makeUnsafe() };
		},
		open,
		read,
		result,
		submit: () => {
			const holding = engine.held?.armed === true;
			tell(holding ? "submit, and the server holds the save" : "submit");
			engine.registry.set(current().submit, undefined);
			return holding ? Deferred.await(held().arrived) : Effect.asVoid(Effect.exit(result()));
		},
	};
}

function failedOutcome(error: unknown): string {
	if (error instanceof Invalid) {
		return "invalid";
	}
	return error instanceof FieldFailure ? `rejected on ${error.path}: ${error.message}` : "failed";
}

function storedValues({ config, saved }: ReturnType<typeof draftStorage>): unknown {
	const raw = saved.get(config.key);
	return raw === undefined ? undefined : Reflect.get(JSON.parse(raw), "values");
}

export function formVerbs<TFields extends Fields, A, E, R, TRuntimeError, TSupport>(
	engine: FormEngine<TFields, A, E, R, TRuntimeError, TSupport>,
	driver: FormDriver<TFields, A, E, R, TRuntimeError, TSupport>,
	tell: (line: string) => void,
) {
	const { current, read, result } = driver;
	return {
		choicesFor: (name: Name<TFields>) => Effect.sync(() => current().choices(name)),
		endSession: () =>
			Effect.sync(() => {
				tell("end the editing session");
				engine.session.drop();
			}),
		enter: <TKey extends Name<TFields>>(name: TKey, value: Encoded<TFields>[TKey]) => Effect.sync(() => driver.change(name, value)),
		feedbackAt: (path: Path<Name<TFields>>) => Effect.sync(() => read(current().errorAt(path))),
		feedbackOn: (name: Name<TFields>) => Effect.sync(() => read(current().error(name))),
		finishSave: driver.finishSave,
		leave: (name: Name<TFields>) =>
			Effect.sync(() => {
				tell(`leave the ${name}`);
				current().blur(name);
			}),
		refresh: (values: Encoded<TFields>) =>
			Effect.sync(() => {
				tell(`the server sends ${inspect(values)}`);
				current().receive(values);
			}),
		reopen: (values: Encoded<TFields>) =>
			Effect.sync(() => {
				tell(`reopen the form while the server holds ${inspect(values)}`);
				driver.open(values);
			}),
		revert: () =>
			Effect.sync(() => {
				tell("revert to the server's values");
				current().revert();
			}),
		savedValue: result,
		saveOutcome: () => result().pipe(Effect.match({ onFailure: failedOutcome, onSuccess: () => "saved" })),
		serverReceived: () => Effect.sync(() => [...engine.received]),
		shown: <TKey extends Name<TFields>>(name: TKey) => Effect.sync((): Encoded<TFields>[TKey] => current().values.value[name]),
		shownValues: () => Effect.sync(() => current().values.value),
		storedDraft: () => Effect.sync(() => storedValues(engine.storage)),
		submit: driver.submit,
		unsavedChanges: () => Effect.sync(() => read(current().dirty)),
	};
}
