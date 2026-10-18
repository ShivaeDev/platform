import { Option, Schema } from "effect";
import { expect, it } from "vitest";
import { rejectedField } from "#errors/rejected-field.ts";
import { BadRequest, Conflict, Forbidden, NotFound, PreconditionFailed, TooManyRequests } from "#errors/taxonomy.ts";
import { rejections } from "#test/rpc/rejections.ts";

const Rejection = Schema.Union([NotFound, BadRequest, Conflict, PreconditionFailed, TooManyRequests]);
rejections.it("taxonomy errors cross native RPC JSON as decoded instances with their field", [], function* ({ rename }) {
	const taken = yield* rename("taken");
	expect(taken).toBeInstanceOf(Conflict);
	expect(rejectedField(taken)).toEqual(Option.some({ field: "name", message: "Name is taken" }));
	expect(rejectedField(yield* rename(""))).toEqual(Option.some({ field: "name", message: "Name is required" }));
	const stale = yield* rename("stale");
	expect(stale).toBeInstanceOf(PreconditionFailed);
	expect(rejectedField(stale)).toEqual(Option.none());
	expect(yield* rename("missing")).toMatchObject({ _tag: "NotFound", message: "No profile" });
	const busy = yield* rename("busy");
	expect(busy).toBeInstanceOf(TooManyRequests);
	expect(busy).toMatchObject({ message: "Slow down" });
	expect(rejectedField(busy)).toEqual(Option.none());
});
class Invalid extends Schema.TaggedError<Invalid>()("Invalid", { field: Schema.Literals(["title"]), message: Schema.String }) {}
it("taxonomy errors encode to tagged JSON and any tagged error with a field is a field rejection", () => {
	expect(Schema.encodeSync(Rejection)(new Conflict({ field: "name", message: "Name is taken" }))).toEqual({
		_tag: "Conflict",
		field: "name",
		message: "Name is taken",
	});
	expect(Schema.encodeSync(Rejection)(new BadRequest({ message: "Malformed" }))).toEqual({ _tag: "BadRequest", message: "Malformed" });
	expect(Schema.encodeSync(Rejection)(new TooManyRequests({ message: "Slow down" }))).toEqual({ _tag: "TooManyRequests", message: "Slow down" });
	expect(rejectedField(new BadRequest({ message: "Malformed" }))).toEqual(Option.none());
	expect(rejectedField(new Forbidden({ message: "No" }))).toEqual(Option.none());
	expect(rejectedField({ _tag: "Conflict", field: "name", message: "Encoded" })).toEqual(Option.some({ field: "name", message: "Encoded" }));
	expect(rejectedField(new Invalid({ field: "title", message: "Too long" }))).toEqual(Option.some({ field: "title", message: "Too long" }));
	expect(rejectedField({ field: "title", message: "Untagged" })).toEqual(Option.none());
	expect(rejectedField({ _tag: 1, field: "title", message: "Numeric tag" })).toEqual(Option.none());
	expect(rejectedField({ _tag: "Invalid", field: 1, message: "Numeric field" })).toEqual(Option.none());
	expect(rejectedField({ _tag: "Invalid", field: "title" })).toEqual(Option.none());
	expect(rejectedField(null)).toEqual(Option.none());
});
