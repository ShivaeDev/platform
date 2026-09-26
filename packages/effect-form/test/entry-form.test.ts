import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Layer, Schema, SchemaGetter } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { Invalid, make } from "../src/index.ts";
import { fromRef } from "../src/refs.ts";

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
	payee: Schema.Trim.check(Schema.isMinLength(1)),
	subtotal: MoneyInput,
	tax: MoneyInput,
	tip: MoneyInput,
	fees: MoneyInput,
	category: Schema.Literals(["travel", "lodging", "supplies", "other"]),
	reimbursable: Schema.Boolean,
	quantity: QuantityInput,
	unit: Schema.Literals(["item", "hour"]),
	date: Schema.optional(Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/))),
});
const initial: typeof ExpenseEntry.Encoded = {
	payee: "  Northwind Cabs  ",
	subtotal: "120.5",
	tax: "",
	tip: "15.5",
	fees: "4",
	category: "travel",
	reimbursable: false,
	quantity: "",
	unit: "item",
};

it.live("entry strings decode to non-negative amounts without inventing a date or quantity", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = make(ExpenseEntry, {
			initialValues: initial,
			runtime,
			onSubmit: Effect.succeed,
		});
		registry.set(form.submit, undefined);
		const submitted = yield* AtomRegistry.getResult(registry, form.submit);
		expect(submitted).toEqual({
			payee: "Northwind Cabs",
			subtotal: 120.5,
			tax: 0,
			tip: 15.5,
			fees: 4,
			category: "travel",
			reimbursable: false,
			quantity: null,
			unit: "item",
		});
		expect(form.field("subtotal").value).toBe("120.5");
		expect(form.field("tax").value).toBe("");
		expect(form.choices("category")).toEqual(["travel", "lodging", "supplies", "other"]);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a reimbursable entry retains hourly units, fractional quantities and a supplied date", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = make(ExpenseEntry, {
			initialValues: initial,
			runtime,
			onSubmit: Effect.succeed,
		});
		form.change("reimbursable", true);
		form.change("unit", "hour");
		form.change("quantity", "2.5");
		form.change("date", "2026-09-18");
		registry.set(form.submit, undefined);
		expect(yield* AtomRegistry.getResult(registry, form.submit)).toMatchObject({
			quantity: 2.5,
			unit: "hour",
			date: "2026-09-18",
			reimbursable: true,
			subtotal: 120.5,
		});
		expect(form.choices("unit")).toEqual(["item", "hour"]);
		for (const absentQuantity of ["", "0", "not a number"]) {
			form.change("quantity", absentQuantity);
			registry.set(form.submit, undefined);
			expect((yield* AtomRegistry.getResult(registry, form.submit)).quantity).toBeNull();
		}
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("invalid required payees and non-finite or negative amounts never reach submission", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		let calls = 0;
		const form = make(ExpenseEntry, {
			initialValues: initial,
			runtime,
			onSubmit: () => Effect.sync(() => calls++),
		});
		for (const invalid of [
			{ ...initial, payee: "   " },
			{ ...initial, subtotal: "-1" },
			{ ...initial, tax: "Infinity" },
			{ ...initial, date: "18/09/2026" },
		]) {
			form.values.set(invalid);
			registry.set(form.submit, undefined);
			expect(yield* Effect.flip(AtomRegistry.getResult(registry, form.submit))).toBeInstanceOf(Invalid);
		}
		expect(calls).toBe(0);
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a failed reimbursable save keeps raw input available for correction and retry", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const form = make(ExpenseEntry, {
			initialValues: { ...initial, reimbursable: true },
			runtime,
			onSubmit: (value, submitter) =>
				value.payee === "Northwind Cabs" ? submitter.fail("payee", "This payee already has a pending claim") : Effect.succeed(value),
		});
		yield* AtomRegistry.mount(registry, form.error("payee"));
		form.change("quantity", "2.50");
		registry.set(form.submit, undefined);
		yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
		expect(form.field("quantity").value).toBe("2.50");
		expect(registry.get(form.error("payee"))).toBe("This payee already has a pending claim");
		form.change("payee", "Northwind Cabs Ltd");
		expect(registry.get(form.error("payee"))).toBeUndefined();
		registry.set(form.submit, undefined);
		expect(yield* AtomRegistry.getResult(registry, form.submit)).toMatchObject({
			payee: "Northwind Cabs Ltd",
			quantity: 2.5,
		});
	}).pipe(Effect.provide(AtomRegistry.layer)),
);

it.live("a delayed save and refresh preserve newer quantity and date edits until explicit revert", () =>
	Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const started = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		const form = make(ExpenseEntry, {
			initialValues: initial,
			runtime,
			onSubmit: (value) => Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release)), Effect.as(value)),
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
			runtime,
			onSubmit: Effect.succeed,
		});
		form.change("payee", "Harbor Hotel");
		form.receive({ ...initial, subtotal: "350" });
		expect(form.field("payee").value).toBe("Harbor Hotel");
		expect(form.field("subtotal").value).toBe("350");
		registry.set(form.submit, undefined);
		expect(yield* AtomRegistry.getResult(registry, form.submit)).toMatchObject({ payee: "Harbor Hotel", subtotal: 350 });
	}).pipe(Effect.provide(AtomRegistry.layer)),
);
