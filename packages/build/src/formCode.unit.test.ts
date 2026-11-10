import { DateTime, Option, Schema } from "effect";
import { expect, it } from "vitest";
import { PRIMITIVE_SCHEMAS } from "#formCode.ts";
import { prototypeOf, roundTrip } from "#test/roundTrip.ts";

const cases = [
	["String", ["", "ü\u0000\n"]],
	["Boolean", [true, false]],
	["Null", [null]],
	["Undefined", [undefined]],
	["Void", [undefined]],
] as const;

for (const [primitive, values] of cases) {
	for (const value of values) {
		it(`${primitive} ${JSON.stringify(value) ?? "undefined"} arrives as itself`, () => {
			expect(roundTrip(Schema[PRIMITIVE_SCHEMAS[primitive]], value)).toBe(value);
		});
	}
}

const NumberWire = Schema[PRIMITIVE_SCHEMAS.Number];

for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0.1, Number.MAX_SAFE_INTEGER]) {
	it(`number ${value} arrives as itself`, () => {
		expect(roundTrip(NumberWire, value)).toBe(value);
	});
}

it("number -0 arrives as 0, because JSON has no -0", () => {
	expect(roundTrip(NumberWire, -0)).toBe(0);
});

for (const value of [9_007_199_254_740_993n, -18_446_744_073_709_551_616n, 0n]) {
	it(`bigint ${value} arrives as itself`, () => {
		expect(roundTrip(Schema[PRIMITIVE_SCHEMAS.BigInt], value)).toBe(value);
	});
}

it("a Date with milliseconds arrives as an equal Date", () => {
	const sent = new Date(Date.UTC(2026, 10, 10, 9, 30, 15, 123));

	const received = roundTrip(Schema[PRIMITIVE_SCHEMAS.Date], sent);

	expect([received, prototypeOf(received)]).toEqual([sent, Date.prototype]);
});

it("an invalid Date cannot be encoded", () => {
	expect(() => roundTrip(Schema[PRIMITIVE_SCHEMAS.Date], new Date(Number.NaN))).toThrow();
});

it("a DateTime.Utc with milliseconds arrives as an equal DateTime.Utc", () => {
	const sent = DateTime.makeUnsafe(Date.UTC(2026, 10, 10, 9, 30, 15, 123));

	const received = roundTrip(Schema[PRIMITIVE_SCHEMAS.DateTimeUtc], sent);

	expect([received, prototypeOf(received)]).toEqual([sent, prototypeOf(sent)]);
});

for (const sent of [Option.none<number>(), Option.some(1), Option.some(Number.NaN)]) {
	it(`${String(sent)} arrives as an equal Option`, () => {
		const received = roundTrip(Schema.Option(Schema.Number), sent);

		expect([received, prototypeOf(received)]).toEqual([sent, prototypeOf(sent)]);
	});
}

for (const [label, schema] of [
	["readonly array", Schema.Array(Schema.String)],
	["mutable array", Schema.mutable(Schema.Array(Schema.String))],
] as const) {
	it(`an empty ${label} arrives empty`, () => {
		expect(roundTrip(schema, [])).toEqual([]);
	});

	it(`a ${label} arrives with its items in order`, () => {
		expect(roundTrip(schema, ["b", "a", "b"])).toEqual(["b", "a", "b"]);
	});
}

it("a tuple arrives with each element in its place", () => {
	expect(roundTrip(Schema.mutable(Schema.Tuple([Schema.Number, Schema.Literal("a")])), [Number.NaN, "a"])).toEqual([Number.NaN, "a"]);
});

const Note = Schema.Struct({
	pinned: Schema.mutableKey(Schema.Boolean),
	summary: Schema.optionalKey(Schema.String),
	title: Schema.String,
	"two words": Schema.mutableKey(Schema.optionalKey(Schema.Number)),
});

it("a struct without its optional keys arrives without them", () => {
	const received = roundTrip(Note, { pinned: false, title: "Plan" });

	expect(received).toStrictEqual({ pinned: false, title: "Plan" });
});

it("a struct with its optional keys arrives with them", () => {
	const sent = { pinned: true, summary: "", title: "Plan", "two words": 2 };

	expect(roundTrip(Note, sent)).toEqual(sent);
});

for (const sent of [{}, { "": 1, "a b": Number.POSITIVE_INFINITY }]) {
	it(`the record ${JSON.stringify(sent)} arrives with the same keys and values`, () => {
		expect(roundTrip(Schema.Record(Schema.String, Schema.mutableKey(Schema.Number)), sent)).toEqual(sent);
	});
}

const Event = Schema.Union([
	Schema.Struct({ id: Schema.Number, kind: Schema.Literal("created") }),
	Schema.Struct({ at: Schema.Date, id: Schema.Number, kind: Schema.Literal("deleted") }),
]);

for (const sent of [
	{ id: 1, kind: "created" },
	{ at: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 1)), id: 2, kind: "deleted" },
] as const) {
	it(`the ${sent.kind} member of a discriminated union arrives as itself`, () => {
		expect(roundTrip(Event, sent)).toEqual(sent);
	});
}

for (const sent of ["draft", 2, null] as const) {
	it(`the literal ${JSON.stringify(sent)} of a nullable literal union arrives as itself`, () => {
		expect(roundTrip(Schema.NullOr(Schema.Literals(["draft", 2])), sent)).toBe(sent);
	});
}

class NoteCard extends Schema.Class<NoteCard>("NoteCard")({ id: Schema.Number, title: Schema.String }) {}

it("a Schema class instance arrives as an equal instance of the class", () => {
	const sent = new NoteCard({ id: 1, title: "Plan" });

	const received = roundTrip(NoteCard, sent);

	expect([received, prototypeOf(received)]).toEqual([sent, NoteCard.prototype]);
});
