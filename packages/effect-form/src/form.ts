import { Effect, Equal, Option, Result, type Schema, SchemaParser } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRef from "effect/unstable/reactivity/AtomRef";
import { draft } from "./draft.ts";
import { type FieldMessages, literalChoices, messageAt, messagesByField, noMessages } from "./messages.ts";
import { fromRef, propertyRef } from "./refs.ts";
import {
	type Config,
	checkOf,
	choicesOf,
	type Decoded,
	type Encoded,
	FieldFailure,
	type Fields,
	type Form,
	fieldOf,
	holder,
	Invalid,
	type Name,
	type Submitter,
} from "./shape.ts";
import { statusOf } from "./status.ts";

export const make = <F extends Fields, A, E, R, ER>(schema: Schema.Struct<F>, config: Config<F, A, E, R, ER>): Form<F, A, E, ER> => {
	const { initialValues, onSubmit, runtime } = config;
	const debounce = config.debounce ?? "300 millis";
	const checks: ReadonlyMap<string, unknown> = new Map(Object.entries(config.checks ?? {}));
	const decode = SchemaParser.decodeUnknownEffect(schema, { errors: "all" });

	const editing = draft(initialValues);
	const { values } = editing;
	const status = statusOf();
	const held = new Map<string, AtomRef.AtomRef<unknown>>();
	const refFor = (name: string): AtomRef.AtomRef<unknown> => {
		const known = held.get(name);
		if (known !== undefined) {
			return known;
		}
		const made = propertyRef(holder(values), name);
		held.set(name, made);
		return made;
	};

	const offered = new Map<string, readonly unknown[]>();
	for (const [name, member] of Object.entries(schema.fields)) {
		const choices = literalChoices(member.ast);
		if (choices !== undefined) {
			offered.set(name, choices);
		}
	}

	const valuesAtom = fromRef(values);

	const decoded = runtime.atom((get) =>
		decode(get(valuesAtom)).pipe(
			Effect.match({
				onFailure: (issue): Result.Result<Decoded<F>, FieldMessages> => Result.fail(messagesByField(issue)),
				onSuccess: (value): Result.Result<Decoded<F>, FieldMessages> => Result.succeed(value),
			}),
		),
	);

	const schemaMessages = Atom.map(decoded, (result) =>
		Option.match(AsyncResult.value(result), {
			onNone: () => noMessages,
			onSome: (either) => (Result.isFailure(either) ? either.failure : noMessages),
		}),
	);

	const schemaError = Atom.family((name: string) => Atom.map(schemaMessages, (messages) => messageAt(messages, name)));

	const checkError = Atom.family((name: string): Atom.Atom<string | undefined> => {
		const check = checks.get(name);
		if (check === undefined) {
			return Atom.make((): string | undefined => undefined);
		}
		const current = fromRef(refFor(name));
		const settled = Atom.debounce(current, debounce);
		const answered = runtime.atom((get) => {
			const input = get(settled);
			return Effect.map(checkOf<R>(check)(input), (message) => ({
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

	const error = Atom.family((name: string) =>
		Atom.readable((get): string | undefined => {
			if (get(status.touched)[name] !== true && !get(status.submitted)) {
				return undefined;
			}
			return messageAt(get(status.failures), name) ?? get(schemaError(name)) ?? get(checkError(name));
		}),
	);

	const noted =
		(submitted: Encoded<F>) =>
		(cause: E | FieldFailure): Effect.Effect<void> =>
			Effect.sync(() => {
				if (cause instanceof FieldFailure && Equal.equals(refFor(cause.path).value, new Map(Object.entries(submitted)).get(cause.path))) {
					status.note(cause.path, cause.message);
				}
			});

	const submitter: Submitter<Name<F>> = {
		fail: (path, message) => Effect.fail(new FieldFailure({ message, path })),
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
		choices: <K extends Name<F>>(name: K) => choicesOf<Encoded<F>[K]>(offered.get(name)),
		dirty: editing.dirty,
		error,
		field: <K extends Name<F>>(name: K) => fieldOf<Encoded<F>[K]>(refFor(name)),
		receive: editing.receive,
		revert: editing.revert,
		submit,
		submitting: Atom.map(submit, AsyncResult.isWaiting),
		values,
	};
};
