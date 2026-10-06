import { expect, it } from "@effect/vitest";
import { Context, Deferred, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { vi } from "vitest";
import { make } from "#form.ts";

const runtime = Atom.runtime(Layer.empty);

const gated = Effect.gen(function* () {
	const started = new Map<string, Deferred.Deferred<void>>();
	const released = new Map<string, Deferred.Deferred<string | undefined>>();
	function entry<V>(map: Map<string, Deferred.Deferred<V>>, value: string): Deferred.Deferred<V> {
		const known = map.get(value);
		if (known !== undefined) {
			return known;
		}
		const made = Deferred.makeUnsafe<V>();
		map.set(value, made);
		return made;
	}
	return {
		answer: (value: string, message: string | undefined) => Deferred.succeed(entry(released, value), message),
		check: (value: string) => Deferred.succeed(entry(started, value), undefined).pipe(Effect.andThen(Deferred.await(entry(released, value)))),
		started: (value: string) => Deferred.await(entry(started, value)),
	};
});

function formWith(check: (value: string) => Effect.Effect<string | undefined>) {
	return make(Schema.Struct({ name: Schema.String }), {
		checks: { name: check },
		debounce: "5 millis",
		initialValues: { name: "" },
		onSubmit: Effect.succeed,
		runtime,
	});
}

function eventually(assert: () => void) {
	return Effect.promise(() => vi.waitFor(assert));
}

it.live("a check result disappears as soon as the field no longer holds the checked value", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = formWith((value) => Effect.succeed(value === "taken" ? "Name is taken" : undefined));
		yield* AtomRegistry.mount(registry, form.error("name"));
		form.change("name", "taken");
		yield* eventually(() => expect(registry.get(form.error("name"))).toBe("Name is taken"));
		form.change("name", "free");
		expect(registry.get(form.error("name"))).toBeUndefined();
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a check result appears only after debounce and completion", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const gate = yield* gated;
		const form = formWith(gate.check);
		yield* AtomRegistry.mount(registry, form.error("name"));
		form.change("name", "slow");
		expect(registry.get(form.error("name"))).toBeUndefined();
		yield* gate.started("slow");
		expect(registry.get(form.error("name"))).toBeUndefined();
		yield* gate.answer("slow", "Slow is taken");
		yield* eventually(() => expect(registry.get(form.error("name"))).toBe("Slow is taken"));
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a failing check never falls back to an earlier value's result", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = formWith((value) =>
			value === "broken" ? Effect.die("check unavailable") : Effect.succeed(value === "taken" ? "Name is taken" : undefined),
		);
		yield* AtomRegistry.mount(registry, form.error("name"));
		form.change("name", "taken");
		yield* eventually(() => expect(registry.get(form.error("name"))).toBe("Name is taken"));
		form.change("name", "broken");
		yield* Effect.sleep("30 millis");
		expect(registry.get(form.error("name"))).toBeUndefined();
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a late result for an older value never overwrites current feedback", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const gate = yield* gated;
		const form = formWith(gate.check);
		yield* AtomRegistry.mount(registry, form.error("name"));
		form.change("name", "old");
		yield* gate.started("old");
		form.change("name", "new");
		yield* gate.answer("old", "Old is taken");
		yield* Effect.sleep("1 millis");
		expect(registry.get(form.error("name"))).toBeUndefined();
		yield* gate.started("new");
		yield* gate.answer("new", "New is taken");
		yield* eventually(() => expect(registry.get(form.error("name"))).toBe("New is taken"));
		yield* Effect.sleep("30 millis");
		expect(registry.get(form.error("name"))).toBe("New is taken");
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

class Reserved extends Context.Service<Reserved, ReadonlySet<string>>()("test/Reserved") {}

it.live("a check reads services from the form runtime", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = make(Schema.Struct({ name: Schema.String }), {
			checks: { name: (value) => Effect.map(Reserved, (reserved) => (reserved.has(value) ? "Name is reserved" : undefined)) },
			debounce: "5 millis",
			initialValues: { name: "" },
			onSubmit: Effect.succeed,
			runtime: Atom.runtime(Layer.succeed(Reserved)(new Set(["admin"]))),
		});
		yield* AtomRegistry.mount(registry, form.error("name"));
		form.change("name", "admin");
		yield* eventually(() => expect(registry.get(form.error("name"))).toBe("Name is reserved"));
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

function recorded(checked: string[]) {
	return (value: string) =>
		Effect.sync(() => {
			checked.push(value);
			return undefined;
		});
}

it.live("a value failing its schema is never sent to the check", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const checked: string[] = [];
		const form = make(Schema.Struct({ name: Schema.String.check(Schema.isMinLength(3)) }), {
			checks: { name: recorded(checked) },
			debounce: "5 millis",
			initialValues: { name: "" },
			onSubmit: Effect.succeed,
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.error("name"));
		form.change("name", "ab");
		expect(registry.get(form.error("name"))).toBe("Expected a value with a length of at least 3");
		form.change("name", "abc");
		yield* eventually(() => expect(checked).toEqual(["abc"]));
	}).pipe(Effect.provide(AtomRegistry.layer)),
);
