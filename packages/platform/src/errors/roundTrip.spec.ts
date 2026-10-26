import { Option } from "effect";
import { expect } from "vitest";
import { rejectedField } from "@shivaedev/contract/errors/rejectedField.ts";
import { BadRequest, Conflict, Forbidden, PreconditionFailed, TooManyRequests } from "@shivaedev/contract/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { rejectionsOptions } from "#test/rpc/rejections.ts";
import { Invalid } from "#test/rpc/renameFixture.ts";

const rejections = storyKit(rejectionsOptions);
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
rejections.it("field and form rejections retain their meaning after native RPC JSON decoding", [], function* ({ rename }) {
	const malformed = yield* rename("malformed");
	expect(malformed).toBeInstanceOf(BadRequest);
	expect(rejectedField(malformed)).toEqual(Option.none());
	const forbidden = yield* rename("forbidden");
	expect(forbidden).toBeInstanceOf(Forbidden);
	expect(rejectedField(forbidden)).toEqual(Option.none());
	const invalid = yield* rename("invalid");
	expect(invalid).toBeInstanceOf(Invalid);
	expect(rejectedField(invalid)).toEqual(Option.some({ field: "title", message: "Too long" }));
});
