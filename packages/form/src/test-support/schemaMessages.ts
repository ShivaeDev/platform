import { Deferred, Effect, Schema, SchemaGetter } from "effect";
import { Invalid } from "#shape.ts";
import { formStories } from "./formStories.ts";

export const Passwords = Schema.Struct({ confirmation: Schema.String, password: Schema.String }).check(
	Schema.makeFilter((value) => value.password === value.confirmation, { message: "Passwords must match" }),
);
export const passwords = formStories(() => Passwords, {
	config: () => ({ initialValues: { confirmation: "second", password: "first" }, onSubmit: Effect.succeed }),
	support: () => undefined,
	verbs: (driver) => ({
		submissionMessage: () =>
			driver
				.result()
				.pipe(Effect.match({ onFailure: (error) => (error instanceof Invalid ? error.formMessage : undefined), onSuccess: () => undefined })),
	}),
});

interface Decode {
	readonly answered: Deferred.Deferred<void>;
	readonly release: Deferred.Deferred<void>;
	readonly started: Deferred.Deferred<void>;
}
function decoding(): Decode {
	return { answered: Deferred.makeUnsafe<void>(), release: Deferred.makeUnsafe<void>(), started: Deferred.makeUnsafe<void>() };
}
function signal(deferred: Deferred.Deferred<void>) {
	queueMicrotask(() => Deferred.doneUnsafe(deferred, Effect.void));
}
function decodeName(calls: { readonly empty: Decode; readonly valid: Decode }, value: string) {
	return Effect.suspend(() => {
		const call = value === "" ? calls.empty : calls.valid;
		signal(call.started);
		return Deferred.await(call.release).pipe(Effect.as(value), Effect.ensuring(Effect.sync(() => signal(call.answered))), Effect.uninterruptible);
	});
}

export const asyncNames = formStories(
	(calls: { readonly empty: Decode; readonly valid: Decode }) =>
		Schema.Struct({
			name: Schema.String.pipe(
				Schema.decodeTo(Schema.NonEmptyString, {
					decode: SchemaGetter.transformEffect((value) => decodeName(calls, value)),
					encode: SchemaGetter.passthrough(),
				}),
			),
		}),
	{
		config: () => ({ initialValues: { name: "" }, onSubmit: Effect.succeed }),
		opened: (form, read) => {
			read(form.error("name"));
		},
		support: () => ({ empty: decoding(), valid: decoding() }),
		verbs: (_driver, tell, calls) => ({
			decodeStarted: (input: "empty" | "valid") => Deferred.await(calls[input].started),
			finishDecode: (input: "empty" | "valid") => {
				tell(`the ${input} name's decode answers`);
				const call = calls[input];
				return Deferred.succeed(call.release, undefined).pipe(Effect.andThen(Deferred.await(call.answered)));
			},
		}),
	},
);
