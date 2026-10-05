import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Layer, Schema, SchemaGetter } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { make } from "#form.ts";
import { fromRef } from "#refs.ts";

const runtime = Atom.runtime(Layer.empty);
const NonNegativeFinite = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
const PositiveFinite = Schema.Finite.check(Schema.isGreaterThan(0));
const MoneyInput = Schema.String.pipe(
	Schema.decodeTo(NonNegativeFinite, {
		decode: SchemaGetter.transform((value) => Number(value) || 0),
		encode: SchemaGetter.transform(String),
	}),
);
const QuantityInput = Schema.String.pipe(
	Schema.decodeTo(Schema.NullOr(PositiveFinite), {
		decode: SchemaGetter.transform((value) => {
			const quantity = Number(value);
			return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
		}),
		encode: SchemaGetter.transform((value) => (value === null ? "" : String(value))),
	}),
);
const ExpenseEntry = Schema.Struct({
	date: Schema.optional(Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u))),
	payee: Schema.Trim.check(Schema.isMinLength(1)),
	quantity: QuantityInput,
	subtotal: MoneyInput,
});
const initial: typeof ExpenseEntry.Encoded = {
	payee: "  Northwind Cabs  ",
	quantity: "",
	subtotal: "120.5",
};

it.live("a delayed save and refresh preserve newer quantity and date edits until explicit revert", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const started = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const form = make(ExpenseEntry, {
			initialValues: initial,
			onSubmit: (value) => Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(value)),
			runtime,
		});
		yield* AtomRegistry.mount(registry, form.dirty);
		const date = fromRef(form.field("date"));
		yield* AtomRegistry.mount(registry, date);
		form.change("quantity", "2");
		registry.set(form.submit, undefined);
		yield* Deferred.await(started);
		form.change("quantity", "3.50");
		form.change("date", "2026-09-18");
		yield* Deferred.succeed(release, undefined);
		expect((yield* AtomRegistry.getResult(registry, form.submit)).quantity).toBe(2);
		form.receive({ ...initial, payee: "Server payee", quantity: "2" });
		expect(form.field("payee").value).toBe("Server payee");
		expect(form.field("quantity").value).toBe("3.50");
		expect(form.field("date").value).toBe("2026-09-18");
		expect(registry.get(form.dirty)).toBe(true);
		form.revert();
		expect(form.field("payee").value).toBe("Server payee");
		expect(form.field("quantity").value).toBe("2");
		expect(form.field("date").value).toBeUndefined();
		expect(registry.get(date)).toBeUndefined();
		expect(Object.hasOwn(form.values.value, "date")).toBe(false);
		expect(registry.get(form.dirty)).toBe(false);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a refresh during an unrelated edit submits the refreshed subtotal, not the stale one", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = make(ExpenseEntry, {
			initialValues: { ...initial, subtotal: "300" },
			onSubmit: Effect.succeed,
			runtime,
		});
		form.change("payee", "Harbor Hotel");
		form.receive({ ...initial, subtotal: "350" });
		expect(form.field("payee").value).toBe("Harbor Hotel");
		expect(form.field("subtotal").value).toBe("350");
		registry.set(form.submit, undefined);
		expect(yield* AtomRegistry.getResult(registry, form.submit)).toMatchObject({ payee: "Harbor Hotel", subtotal: 350 });
	}).pipe(Effect.provide(AtomRegistry.layer)),
);
