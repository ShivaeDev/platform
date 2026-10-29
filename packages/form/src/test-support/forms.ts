import { Context, Data, Deferred, Effect, Layer, Schema, SchemaGetter } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRef from "effect/reactivity/AtomRef";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
const none = { support: () => undefined, verbs: () => ({}) };

export const requiredName = formStories(() => Schema.Struct({ name: Schema.NonEmptyString }), {
	...none,
	config: () => ({ initialValues: { name: "" }, onSubmit: Effect.succeed, runtime }),
});

const TAKEN_NAME = "ada";
export const serverNames = formStories(() => Schema.Struct({ name: Schema.String }), {
	...none,
	config: () => ({
		initialValues: { name: TAKEN_NAME },
		onSubmit: (value, submitter) => (value.name === TAKEN_NAME ? submitter.fail("name", "Already used") : Effect.succeed(value.name)),
		runtime,
	}),
});

export const visibility = formStories(() => Schema.Struct({ visibility: Schema.Literals(["private", "public"]) }), {
	...none,
	config: () => ({ initialValues: { visibility: "private" as const }, onSubmit: Effect.succeed, runtime }),
});

const YesNo = Schema.Literals(["yes", "no"]).pipe(
	Schema.decodeTo(Schema.Boolean, {
		decode: SchemaGetter.transform((value) => value === "yes"),
		encode: SchemaGetter.transform((value) => (value ? "yes" : "no")),
	}),
);
export const agreement = formStories(() => Schema.Struct({ agreed: YesNo }), {
	...none,
	config: () => ({ initialValues: { agreed: "yes" as const }, onSubmit: Effect.succeed, runtime }),
});

export const prototypeNamed = formStories(() => Schema.Struct({ toString: Schema.NonEmptyString }), {
	...none,
	config: () => ({ initialValues: { toString: "" }, onSubmit: Effect.succeed, runtime }),
});

class SlugTaken extends Data.TaggedError("SlugTaken")<{ readonly slug: string }> {}
class Slugs extends Context.Service<Slugs, { readonly claim: (slug: string) => Effect.Effect<string, SlugTaken> }>()("test/Slugs") {}
export const HELD_SLUG = "root";
export const slugs = formStories(() => Schema.Struct({ slug: Schema.String, title: Schema.String }), {
	...none,
	config: () => ({
		initialValues: { slug: HELD_SLUG, title: "Ops" },
		onSubmit: (values, { fail }) =>
			Effect.flatMap(Slugs, (service) => service.claim(values.slug)).pipe(
				Effect.catchTag("SlugTaken", (taken) => fail("slug", `"${taken.slug}" is already in use`)),
			),
		runtime: Atom.runtime(
			Layer.succeed(Slugs)({ claim: (slug) => (slug === HELD_SLUG ? Effect.fail(new SlugTaken({ slug })) : Effect.succeed(slug)) }),
		),
	}),
});

export const names = formStories(() => Schema.Struct({ name: Schema.String }), {
	...none,
	config: () => ({ initialValues: { name: "First" }, onSubmit: Effect.succeed, runtime }),
});

interface SlowDecode {
	readonly finished: Deferred.Deferred<void>;
	readonly release: Deferred.Deferred<void>;
	readonly started: Deferred.Deferred<void>;
}
function slowlyDecodedName({ finished, release, started }: SlowDecode) {
	return Schema.Struct({
		name: Schema.String.pipe(
			Schema.decodeTo(Schema.NonEmptyString, {
				decode: SchemaGetter.transformEffect((value) =>
					Deferred.succeed(started, undefined).pipe(
						Effect.andThen(Deferred.await(release)),
						Effect.andThen(Deferred.succeed(finished, undefined)),
						Effect.as(value),
					),
				),
				encode: SchemaGetter.passthrough(),
			}),
		),
	});
}
export const slowNames = formStories(slowlyDecodedName, {
	config: () => ({ initialValues: { name: "" }, onSubmit: Effect.succeed, runtime }),
	opened: (form, read) => {
		read(form.error("name"));
	},
	support: (): SlowDecode => ({ finished: Deferred.makeUnsafe(), release: Deferred.makeUnsafe(), started: Deferred.makeUnsafe() }),
	verbs: (_driver, tell, decode) => ({
		finishDecode: () => {
			tell("the name's decode finishes");
			return Deferred.succeed(decode.release, undefined).pipe(Effect.andThen(Deferred.await(decode.finished)));
		},
	}),
});

export function nameLeftWhileDecoding() {
	return slowNames.step("the name is left, and its decode starts and waits", (driver, engine) => {
		driver.current().blur("name");
		return Deferred.await(engine.support.started);
	});
}

const Profile = Schema.Struct({ count: Schema.Number, label: Schema.String });
interface LabelView {
	view?: AtomRef.ReadonlyRef<string>;
}
export const profiles = formStories(() => Schema.Struct({ profile: Profile }), {
	config: () => ({ initialValues: { profile: { count: 1, label: "First" } }, onSubmit: Effect.succeed, runtime }),
	opened: (form, _read, label: LabelView) => {
		label.view = form.field("profile").map((profile) => profile.label);
	},
	support: (): LabelView => ({}),
	verbs: (driver, tell, label) => ({
		countUp: () =>
			Effect.sync(() => {
				tell("count the profile up by one");
				driver
					.current()
					.field("profile")
					.update((profile) => ({ ...profile, count: profile.count + 1 }));
			}),
		labelView: () => Effect.sync(() => label.view?.value),
		setCountThroughProp: (count: number) =>
			Effect.sync(() => {
				tell(`set the profile count to ${count} through the field's count prop`);
				driver.current().field("profile").prop("count").set(count);
			}),
	}),
});
