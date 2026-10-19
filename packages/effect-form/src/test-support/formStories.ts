import { Deferred, Effect, type Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { draftSession } from "#draftSession.ts";
import { make } from "#form.ts";
import type { Config, Decoded, Encoded, FieldFailure, Fields, Name, Path } from "#shape.ts";
import { checkGate } from "./checkGate.ts";
import { draftStorage } from "./draftStorage.ts";
import type { FormEngine, FormSupport } from "./formEngine.ts";
import { formVerbs } from "./formVerbs.ts";
import { registry as freshRegistry } from "./registry.ts";

export function formStories<TFields extends Fields, A = Decoded<TFields>, E = never, R = never, TRuntimeError = never>(
	schema: (support: FormSupport) => Schema.Struct<TFields>,
	configure: (support: FormSupport) => Config<TFields, A, E, R, TRuntimeError>,
) {
	const kit = storyKit({
		after: {
			setup(state) {
				const handler = state.config.onSubmit;
				state.config = {
					...state.config,
					onSubmit: (values, submitter, submitted) => {
						state.submissions.push(values);
						return handler(values, submitter, submitted);
					},
				};
				state.current = make(state.schema, state.config);
				state.registry.mount(state.current.dirty);
				state.mounted.add(state.current.dirty);
			},
		},
		clock: "live",
		*create() {
			const registry = yield* freshRegistry;
			const started = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			const storage = draftStorage();
			const support: FormSupport = { checked: [], checkGate: checkGate(), release, session: draftSession("form-session"), started, storage };
			const config: Config<TFields, A, E | FieldFailure, R, TRuntimeError> = configure(support);
			const engine: FormEngine<TFields, A, E | FieldFailure, R, TRuntimeError> = {
				...support,
				config,
				current: undefined,
				mounted: new Set(),
				observed: new Map(),
				registry,
				schema: schema(support),
				submissions: [],
			};
			return engine;
		},
		inspect: (state) => ({
			dirty: state.current && state.registry.get(state.current.dirty),
			drafts: Object.fromEntries(state.storage.saved),
			errors: Object.fromEntries(Array.from(state.observed, ([path, atom]) => [path, state.registry.get(atom)])),
			submissions: state.submissions,
			submitting: state.current && state.registry.get(state.current.submitting),
			values: state.current?.values.value,
		}),
		name: "form",
		stages: ["setup"],
		verbs: formVerbs<TFields, A, E | FieldFailure, R, TRuntimeError>,
	});
	return {
		...kit,
		delayed: () =>
			kit.trait("setup", "the first save waits for the server", (state) => {
				const handler = state.config.onSubmit;
				let waiting = true;
				state.config = {
					...state.config,
					onSubmit: (values, submitter, submitted) => {
						if (!waiting) {
							return handler(values, submitter, submitted);
						}
						waiting = false;
						return Deferred.succeed(state.started, undefined).pipe(
							Effect.andThen(Deferred.await(state.release)),
							Effect.andThen(Effect.suspend(() => handler(values, submitter, submitted))),
						);
					},
				};
			}),
		persisted: () =>
			kit.trait("setup", "the draft is persisted", (state) => {
				state.config = { ...state.config, persistedDraft: state.storage.config };
			}),
		rejects: (path: Name<TFields> | Path<Name<TFields>>, message: string) =>
			kit.trait("setup", `the server rejects ${String(path)}: ${message}`, (state) => {
				state.config = { ...state.config, onSubmit: (_, submitter) => submitter.fail(path, message) };
			}),
		sessionOwned: () =>
			kit.trait("setup", "the session owns the stored draft", (state) => {
				state.config = { ...state.config, persistedDraft: { ...state.storage.config, session: state.session } };
			}),
		withSchema: (fields: Schema.Struct<TFields>) =>
			kit.trait("setup", "the form uses the field schema", (state) => {
				state.schema = fields;
			}),
		withStoredDraft: (baseline: Encoded<TFields>, values: Encoded<TFields>) =>
			kit.trait("setup", "an earlier editing session stored a draft", (state) => {
				state.config = { ...state.config, persistedDraft: state.storage.config };
				const previous = make(state.schema, { ...state.config, initialValues: baseline });
				previous.values.set(values);
			}),
		withValues: (initialValues: Encoded<TFields>) =>
			kit.trait("setup", `the form starts with ${JSON.stringify(initialValues)}`, (state) => {
				state.config = { ...state.config, initialValues };
			}),
	};
}
