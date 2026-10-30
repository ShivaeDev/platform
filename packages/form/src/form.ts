import { Effect, Equal, Result, Schema, type SchemaIssue, SchemaParser } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRef from "effect/reactivity/AtomRef";
import { draft } from "./draft.ts";
import { literalChoices, messageAt, messagesByField, schemaFeedback } from "./messages.ts";
import { pathMessageAt } from "./paths.ts";
import { persistence } from "./persistence.ts";
import { fromRef, propertyRef } from "./refs.ts";
import { type Config, type Decoded, type Encoded, FieldFailure, type Fields, type Form, Invalid, type Name, type Submitter } from "./shape.ts";
import { statusOf } from "./statusOf.ts";
import { trackRejections } from "./trackRejections.ts";

export function form<TFields extends Fields, TValue, TError, TServices, TRuntimeError>(
	schema: Schema.Struct<TFields>,
	config: Config<TFields, TValue, TError, TServices, TRuntimeError>,
): Form<TFields, TValue, TError, TRuntimeError> {
	const { initialValues, onSubmit, runtime } = config;
	const debounce = config.debounce ?? "300 millis";
	const checks: ReadonlyMap<string, (value: Encoded<TFields>[Name<TFields>]) => Effect.Effect<string | undefined, never, TServices>> = new Map(
		Object.entries(config.checks ?? {}),
	);
	const decode = SchemaParser.decodeUnknownEffect(schema, { errors: "all" });

	const editing = draft(initialValues, config.persistedDraft ? persistence(schema, config.persistedDraft) : undefined);
	const { values } = editing;
	const status = statusOf();
	const noted = trackRejections(values, config.arrayKeys, status);
	const held: { [TKey in Name<TFields>]?: AtomRef.AtomRef<Encoded<TFields>[TKey]> } = {};
	function refFor<TKey extends Name<TFields>>(name: TKey): AtomRef.AtomRef<Encoded<TFields>[TKey]> {
		const known = Object.hasOwn(held, name) ? held[name] : undefined;
		if (known !== undefined) {
			return known;
		}
		const made = propertyRef(values, name);
		held[name] = made;
		return made;
	}

	const valuesAtom = fromRef(values);

	const decoded = runtime.atom((get) =>
		decode(get(valuesAtom)).pipe(
			Effect.match({
				onFailure: (issue): Result.Result<Decoded<TFields>, SchemaIssue.Issue> => Result.fail(issue),
				onSuccess: (value): Result.Result<Decoded<TFields>, SchemaIssue.Issue> => Result.succeed(value),
			}),
		),
	);

	const schemaErrors = schemaFeedback(decoded);

	const checkError = Atom.family((name: Name<TFields>): Atom.Atom<string | undefined> => {
		const check = checks.get(name);
		if (check === undefined) {
			return Atom.make((): string | undefined => undefined);
		}
		const current = fromRef(refFor(name));
		const settled = Atom.debounce(current, debounce);
		const answered = runtime.atom((get) => {
			const input = get(settled);
			return Effect.map(check(input), (message) => ({
				input,
				message,
			}));
		});
		return Atom.readable((get): string | undefined => {
			const result = get(answered);
			const value = get(current);
			return AsyncResult.isSuccess(result) && !result.waiting && Equal.equals(result.value.input, value) ? result.value.message : undefined;
		});
	});

	const error = Atom.family((name: Name<TFields>) =>
		Atom.readable((get): string | undefined => {
			if (get(status.touched)[name] !== true && !get(status.submitted)) {
				return undefined;
			}
			return messageAt(get(status.failures), name) ?? get(schemaErrors.field(name)) ?? get(checkError(name));
		}),
	);

	const submitter: Submitter<Name<TFields>> = {
		fail: (path, message) => Effect.fail(new FieldFailure(typeof path === "string" ? { message, path } : { message, path: path[0], segments: path })),
	};

	const submit = runtime.fn<void>()(() =>
		Effect.gen(function* () {
			status.attempt();
			const submission = editing.submission();
			const submitted = submission.values;
			const value = yield* decode(submitted).pipe(Effect.mapError((issue) => new Invalid({ messages: messagesByField(issue) })));
			return yield* onSubmit(value, submitter, submitted).pipe(
				Effect.tapError(noted(submitted)),
				Effect.tap(() => Effect.sync(submission.accept)),
			);
		}),
	);

	return {
		blur: status.touch,
		change: (name, value) => {
			refFor(name).set(value);
			status.touch(name);
		},
		choices: <TName extends Name<TFields>>(name: TName) => {
			const member = schema.fields[name];
			const decodeChoice = SchemaParser.decodeUnknownSync(Schema.toEncoded(schema), { disableChecks: true });
			return (member ? literalChoices(member.ast) : undefined)?.map((value) => decodeChoice({ ...initialValues, [name]: value })[name]);
		},
		dirty: editing.dirty,
		error,
		errorAt: Atom.family((path: readonly [Name<TFields>, ...PropertyKey[]]) => {
			const message = schemaErrors.at(path);
			return Atom.readable((get) =>
				get(status.touched)[path[0]] === true || get(status.submitted) ? (pathMessageAt(get(status.paths), path) ?? get(message)) : undefined,
			);
		}),
		field: refFor,
		receive: editing.receive,
		revert: editing.revert,
		submit,
		submitting: Atom.map(submit, AsyncResult.isWaiting),
		values,
	};
}
