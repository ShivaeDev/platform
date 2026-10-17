import { Context, Data, Deferred, Effect, Layer, Schema, SchemaGetter } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { FormSupport } from "./formEngine.ts";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
export const requiredName = formStories(
	() => Schema.Struct({ name: Schema.NonEmptyString }),
	() => ({
		initialValues: { name: "" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const takenName = formStories(
	() => Schema.Struct({ name: Schema.String }),
	() => ({
		initialValues: { name: "taken" },
		onSubmit: (value, submitter) => (value.name === "taken" ? submitter.fail("name", "Already used") : Effect.succeed(value.name)),
		runtime,
	}),
);
export const visibility = formStories(
	() => Schema.Struct({ visibility: Schema.Literals(["private", "public"]) }),
	() => ({
		initialValues: { visibility: "private" as const },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
const Choice = Schema.Literals(["yes", "no"]).pipe(
	Schema.decodeTo(Schema.Boolean, {
		decode: SchemaGetter.transform((value) => value === "yes"),
		encode: SchemaGetter.transform((value) => (value ? "yes" : "no")),
	}),
);
export const choices = formStories(
	() => Schema.Struct({ choice: Choice }),
	() => ({
		initialValues: { choice: "yes" as const },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const prototype = formStories(
	() => Schema.Struct({ toString: Schema.NonEmptyString }),
	() => ({
		initialValues: { toString: "" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);

class SlugTaken extends Data.TaggedError("SlugTaken")<{ readonly slug: string }> {}
class Slugs extends Context.Service<Slugs, { readonly claim: (slug: string) => Effect.Effect<string, SlugTaken> }>()("test/Slugs") {}
export const slugs = formStories(
	() => Schema.Struct({ slug: Schema.String, title: Schema.String }),
	() => ({
		initialValues: { slug: "root", title: "Ops" },
		onSubmit: (values, { fail }) =>
			Effect.flatMap(Slugs, (service) => service.claim(values.slug)).pipe(
				Effect.catchTag("SlugTaken", (taken) => fail("slug", `"${taken.slug}" is already in use`)),
			),
		runtime: Atom.runtime(Layer.succeed(Slugs)({ claim: (slug) => (slug === "root" ? Effect.fail(new SlugTaken({ slug })) : Effect.succeed(slug)) })),
	}),
);
export const plainName = formStories(
	() => Schema.Struct({ name: Schema.String }),
	() => ({
		initialValues: { name: "" },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
function pendingName({ started, release }: FormSupport) {
	return Schema.Struct({
		name: Schema.String.pipe(
			Schema.decodeTo(Schema.NonEmptyString, {
				decode: SchemaGetter.transformEffect((value) =>
					Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(value)),
				),
				encode: SchemaGetter.passthrough(),
			}),
		),
	});
}
export const asyncName = formStories(pendingName, () => ({ initialValues: { name: "" }, onSubmit: Effect.succeed, runtime }));
export const profiles = formStories(
	() => Schema.Struct({ profile: Schema.Struct({ count: Schema.Number, label: Schema.String }) }),
	() => ({
		initialValues: { profile: { count: 1, label: "First" } },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
export const nestedProp = formStories(
	() => Schema.Struct({ profile: Schema.Struct({ count: Schema.Number }) }),
	() => ({
		initialValues: { profile: { count: 1 } },
		onSubmit: Effect.succeed,
		runtime,
	}),
);
