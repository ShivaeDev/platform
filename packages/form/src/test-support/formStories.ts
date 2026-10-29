import { Deferred, Effect, type Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { draftSession } from "#draftSession.ts";
import type { Config, Decoded, Encoded, FieldFailure, Fields, Form, Name, Path } from "#shape.ts";
import { draftStorage } from "./draftStorage.ts";
import type { FormEngine } from "./formEngine.ts";
import { type FormDriver, formDriver, formVerbs } from "./formVerbs.ts";
import { registry as freshRegistry } from "./registry.ts";

interface Definition<TFields extends Fields, A, E, R, TRuntimeError, TSupport, TVerbs> {
	readonly config: (support: TSupport) => Config<TFields, A, E, R, TRuntimeError>;
	readonly opened?: (form: Form<TFields, A, E | FieldFailure, TRuntimeError>, read: <T>(atom: Atom.Atom<T>) => T, support: TSupport) => void;
	readonly support: () => TSupport;
	readonly verbs: (driver: FormDriver<TFields, A, E, R, TRuntimeError, TSupport>, tell: (line: string) => void, support: TSupport) => TVerbs;
}

function silent() {
	return undefined;
}

function answeredByEngine<TFields extends Fields, A, E, R, TRuntimeError, TSupport>(
	engine: FormEngine<TFields, A, E, R, TRuntimeError, TSupport>,
): Config<TFields, A, E | FieldFailure, R, TRuntimeError>["onSubmit"] {
	const handler = engine.config.onSubmit;
	return (values, submitter, submitted) => {
		engine.received.push(values);
		const answer = Effect.suspend(() =>
			engine.rejection === undefined ? handler(values, submitter, submitted) : submitter.fail(engine.rejection.path, engine.rejection.message),
		);
		const held = engine.held;
		if (held?.armed !== true) {
			return answer;
		}
		held.armed = false;
		return Deferred.succeed(held.arrived, undefined).pipe(Effect.andThen(Deferred.await(held.release)), Effect.andThen(answer));
	};
}

export function formStories<
	TFields extends Fields,
	A = Decoded<TFields>,
	E = never,
	R = never,
	TRuntimeError = never,
	TSupport = undefined,
	TVerbs extends object = object,
>(schema: (support: TSupport) => Schema.Struct<TFields>, definition: Definition<TFields, A, E, R, TRuntimeError, TSupport, TVerbs>) {
	type Engine = FormEngine<TFields, A, E, R, TRuntimeError, TSupport>;
	type Driver = FormDriver<TFields, A, E, R, TRuntimeError, TSupport>;
	const kit = storyKit({
		after: {
			form(engine: Engine) {
				engine.config = { ...engine.config, onSubmit: answeredByEngine(engine) };
				const driver = formDriver(engine, silent);
				driver.open(engine.config.initialValues);
			},
		},
		clock: "live",
		*create() {
			const registry = yield* freshRegistry;
			const support = definition.support();
			const engine: Engine = {
				config: definition.config(support),
				current: undefined,
				held: undefined,
				mounted: new Set(),
				opened: (form, read) => definition.opened?.(form, read, support),
				received: [],
				registry,
				rejection: undefined,
				schema: schema(support),
				session: draftSession("form-session"),
				storage: draftStorage(),
				support,
			};
			return engine;
		},
		inspect: (engine: Engine) => ({
			drafts: Object.fromEntries(engine.storage.saved),
			received: engine.received,
			unsaved: engine.current && engine.registry.get(engine.current.dirty),
			values: engine.current?.values.value,
		}),
		name: "form",
		stages: ["form", "editing"],
		verbs: (engine: Engine, story) => {
			const driver = formDriver(engine, story.tell);
			return { ...formVerbs(engine, driver, story.tell), ...definition.verbs(driver, story.tell, engine.support) };
		},
	});
	function configured(line: string, apply: (engine: Engine) => void) {
		return kit.trait("form", line, apply);
	}
	function step(line: string, act: (driver: Driver, engine: Engine) => Effect.Effect<void> | void) {
		return kit.trait("editing", line, (engine) => act(formDriver(engine, silent), engine) ?? Effect.void);
	}
	return {
		...kit,
		draftsStored: () =>
			configured("the form stores its draft", (engine) => {
				engine.config = { ...engine.config, persistedDraft: engine.storage.config };
			}),
		edited: <TKey extends Name<TFields>>(name: TKey, value: Encoded<TFields>[TKey]) =>
			step(`the ${name} is changed to ${JSON.stringify(value)}`, (driver) => driver.change(name, value)),
		refreshReceived: (values: Encoded<TFields>) => step(`the server sends ${JSON.stringify(values)}`, (driver) => driver.current().receive(values)),
		reopened: (values: Encoded<TFields>) =>
			step(`the form is reopened while the server holds ${JSON.stringify(values)}`, (driver) => {
				driver.open(values);
			}),
		saveAnswered: () => step("the server answers the held save", (driver) => driver.finishSave()),
		saveInFlight: () =>
			step("the form is submitted and the server holds the save", (driver) => {
				driver.holdNextSave();
				return driver.submit();
			}),
		schemaIs: (line: string, replacement: Schema.Struct<TFields>) =>
			configured(line, (engine) => {
				engine.schema = replacement;
			}),
		serverRejects: (path: Name<TFields> | Path<Name<TFields>>, message: string) =>
			configured(`the server rejects every save on ${JSON.stringify(path)}: ${message}`, (engine) => {
				engine.rejection = { message, path };
			}),
		sessionEnded: () =>
			step("the editing session ends", (_driver, engine) => {
				engine.session.drop();
			}),
		sessionOwnsDraft: () =>
			configured("the editing session owns the stored draft", (engine) => {
				engine.config = { ...engine.config, persistedDraft: { ...engine.storage.config, session: engine.session } };
			}),
		startsWith: (initialValues: Encoded<TFields>) =>
			configured(`the form starts with ${JSON.stringify(initialValues)}`, (engine) => {
				engine.config = { ...engine.config, initialValues };
			}),
		step,
		submitted: () => step("the form is submitted and the server answers", (driver) => driver.submit()),
	};
}
