import { Context, Deferred, Effect, Layer, Schema, SchemaGetter } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { formStories } from "#test/formStories.ts";

class Names extends Context.Service<Names, { readonly normalize: (name: string) => Effect.Effect<string> }>()("@shivaedev/form/test/Names") {}

export const runtimeValidation = formStories(
	() =>
		Schema.Struct({
			name: Schema.String.pipe(
				Schema.decodeTo(Schema.NonEmptyString, {
					decode: SchemaGetter.transformEffect((name) => Effect.flatMap(Names, (service) => service.normalize(name))),
					encode: SchemaGetter.passthrough(),
				}),
			),
		}),
	{
		config: (decode) => ({
			initialValues: { name: "  Ada  " },
			onSubmit: Effect.succeed,
			runtime: Atom.runtime(
				Layer.succeed(Names)({
					normalize: (name) =>
						Deferred.succeed(decode.started, undefined).pipe(Effect.andThen(Deferred.await(decode.release)), Effect.as(name.trim())),
				}),
			),
		}),
		support: () => ({ release: Deferred.makeUnsafe<void>(), started: Deferred.makeUnsafe<void>() }),
		verbs: (driver, tell, decode) => ({
			beginValidation: () => {
				tell("validate while the name's service holds decoding");
				driver.engine.registry.set(driver.current().validate, undefined);
				return Deferred.await(decode.started);
			},
			finishDecoding: () => {
				tell("the name's service finishes decoding");
				return Deferred.succeed(decode.release, undefined).pipe(
					Effect.andThen(AtomRegistry.getResult(driver.engine.registry, driver.current().validate, { suspendOnWaiting: true })),
					Effect.exit,
					Effect.asVoid,
				);
			},
		}),
	},
);
