import { expect, it } from "@effect/vitest";
import { Context, Data, Effect, Layer, Schema, SchemaGetter } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { make } from "#form.ts";
import { Invalid } from "#shape.ts";

const runtime = Atom.runtime(Layer.empty);

it.live("invalid submission reveals field errors and never calls the handler", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		let calls = 0;
		const form = make(Schema.Struct({ name: Schema.NonEmptyString }), {
			initialValues: { name: "" },
			onSubmit: () =>
				Effect.sync(() => {
					calls += 1;
				}),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.error("name"));
		expect(registry.get(form.error("name"))).toBeUndefined();
		registry.set(form.submit, undefined);
		const failure = yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
		expect(failure).toBeInstanceOf(Invalid);
		expect(calls).toBe(0);
		expect(registry.get(form.error("name"))).toBe("Required");
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("changing a field clears its server rejection and a retry submits the new value", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = make(Schema.Struct({ name: Schema.String }), {
			initialValues: { name: "taken" },
			onSubmit: (value, submitter) => (value.name === "taken" ? submitter.fail("name", "Already used") : Effect.succeed(value.name)),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.error("name"));
		registry.set(form.submit, undefined);
		yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
		expect(registry.get(form.error("name"))).toBe("Already used");
		form.change("name", "available");
		expect(registry.get(form.error("name"))).toBeUndefined();
		registry.set(form.submit, undefined);
		expect(yield* AtomRegistry.getResult(registry, form.submit)).toBe("available");
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it("derives literal choices from the field schema", () => {
	const form = make(Schema.Struct({ visibility: Schema.Literals(["private", "public"]) }), {
		initialValues: { visibility: "private" },
		onSubmit: Effect.succeed,
		runtime,
	});
	expect(form.choices("visibility")).toEqual(["private", "public"]);
});

it("offers encoded literals when the field transforms them", () => {
	const choice = Schema.Literals(["yes", "no"]).pipe(
		Schema.decodeTo(Schema.Boolean, {
			decode: SchemaGetter.transform((value) => value === "yes"),
			encode: SchemaGetter.transform((value) => (value ? "yes" : "no")),
		}),
	);
	const form = make(Schema.Struct({ choice }), {
		initialValues: { choice: "yes" },
		onSubmit: Effect.succeed,
		runtime,
	});
	expect(form.choices("choice")).toEqual(["yes", "no"]);
});

it.live("prototype-named fields have ordinary choices and validation messages", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = make(Schema.Struct({ toString: Schema.NonEmptyString }), {
			initialValues: { toString: "" },
			onSubmit: Effect.succeed,
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.error("toString"));
		expect(form.choices("toString")).toBeUndefined();
		expect(registry.get(form.error("toString"))).toBeUndefined();
		registry.set(form.submit, undefined);
		yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
		expect(registry.get(form.error("toString"))).toBe("Required");
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

class SlugTaken extends Data.TaggedError("SlugTaken")<{ readonly slug: string }> {}

class Slugs extends Context.Service<Slugs, { readonly claim: (slug: string) => Effect.Effect<string, SlugTaken> }>()("test/Slugs") {}

it.live("a submit handler reads runtime services and reports a domain failure on its field", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = make(Schema.Struct({ slug: Schema.String, title: Schema.String }), {
			initialValues: { slug: "root", title: "Ops" },
			onSubmit: (values, { fail }) =>
				Effect.flatMap(Slugs, (slugs) => slugs.claim(values.slug)).pipe(
					Effect.catchTag("SlugTaken", (taken) => fail("slug", `"${taken.slug}" is already in use`)),
				),
			runtime: Atom.runtime(
				Layer.succeed(Slugs)({ claim: (slug) => (slug === "root" ? Effect.fail(new SlugTaken({ slug })) : Effect.succeed(slug)) }),
			),
		});
		yield* AtomRegistry.mount(registry, form.error("slug"));
		yield* AtomRegistry.mount(registry, form.error("title"));
		registry.set(form.submit, undefined);
		yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
		expect(registry.get(form.error("slug"))).toBe(`"root" is already in use`);
		expect(registry.get(form.error("title"))).toBeUndefined();
		form.change("slug", "staging");
		registry.set(form.submit, undefined);
		expect(yield* AtomRegistry.getResult(registry, form.submit)).toBe("staging");
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("dirty clears when an edit is undone", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = make(Schema.Struct({ name: Schema.String }), {
			initialValues: { name: "" },
			onSubmit: Effect.succeed,
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		form.change("name", "Ops");
		expect(registry.get(form.dirty)).toBe(true);
		form.change("name", "");
		expect(registry.get(form.dirty)).toBe(false);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);
