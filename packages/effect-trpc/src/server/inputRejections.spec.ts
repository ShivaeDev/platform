import { Option } from "effect";
import { describe, expect } from "vitest";
import { BadRequest } from "#test/inputSchemas.ts";
import { profileInputs } from "#test/profileInputs.ts";
import { trpc } from "#test/routerStory.ts";

const valid = { address: { city: "London" }, name: "Ada", tags: ["admin"] };

describe("input validation failures cross as BadRequest field rejections", () => {
	trpc.it(
		"names the first issue's field with a dotted path",
		[profileInputs()],
		function* ({ rejection: readRejection, decode, rejectMutation, exchanges }) {
			const error = yield* rejectMutation("save", { ...valid, address: { city: "" } });
			const rejection = Option.getOrThrow(readRejection(error));
			expect(exchanges.at(-1)?.status).toBe(400);
			expect(error).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400, path: "save" }, message: rejection.message });
			expect(rejection).toEqual({ _tag: "BadRequest", field: "address.city", invalidInput: true, message: expect.any(String) });
			expect(Option.getOrThrow(decode(BadRequest, error))).toBeInstanceOf(BadRequest);
		},
	);
	trpc.it("keeps array indexes in the path", [profileInputs()], function* ({ rejection, rejectMutation }) {
		const error = yield* rejectMutation("save", { ...valid, tags: ["admin", ""] });
		expect(rejection(error)).toMatchObject(Option.some({ _tag: "BadRequest", field: "tags.1" }));
	});
	trpc.it("omits the field when the issue concerns the whole input", [profileInputs()], function* ({ rejection, rejectQuery }) {
		const error = yield* rejectQuery("range", { from: 2, to: 1 });
		expect(rejection(error)).toEqual(Option.some({ _tag: "BadRequest", invalidInput: true, message: "from must not be after to" }));
		expect(error).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 }, message: "from must not be after to" });
	});
	trpc.it(
		"is marked as invalid input, unlike a BadRequest with a field that the procedure raises",
		[profileInputs()],
		function* ({ rejection, rejectMutation, mutate, exchanges }) {
			const invalid = yield* rejectMutation("save", { ...valid, name: "" });
			const invalidBody = exchanges.at(-1)?.body;
			const raised = yield* rejectMutation("save", { ...valid, name: "taken" });
			const raisedBody = exchanges.at(-1)?.body;
			expect(invalidBody).toContain('"invalidInput":true');
			expect(raisedBody).not.toContain("invalidInput");
			expect(Object.keys(Option.getOrThrow(rejection(invalid))).sort((left, right) => left.localeCompare(right))).toEqual([
				"_tag",
				"field",
				"invalidInput",
				"message",
			]);
			expect(Option.map(rejection(invalid), ({ invalidInput }) => invalidInput)).toEqual(Option.some(true));
			expect(rejection(raised)).toEqual(Option.some({ _tag: "BadRequest", field: "name", message: "Name is taken" }));
			expect(Option.map(rejection(raised), ({ invalidInput }) => invalidInput)).toEqual(Option.some(undefined));
			expect(invalid).toMatchObject({
				data: { code: "BAD_REQUEST", httpStatus: 400, rejection: { _tag: "BadRequest", field: "name", invalidInput: true } },
			});
			expect(raised).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 } });
			expect(yield* mutate("save", valid)).toBe("Ada");
		},
	);
	trpc.it(
		"still decodes as the declared BadRequest, so clients that ignore the mark are unchanged",
		[profileInputs()],
		function* ({ decode, rejectMutation }) {
			const invalid = yield* rejectMutation("save", { ...valid, name: "" });
			const raised = yield* rejectMutation("save", { ...valid, name: "taken" });
			expect(Option.getOrThrow(decode(BadRequest, invalid))).toMatchObject({ _tag: "BadRequest", field: "name" });
			expect(Option.getOrThrow(decode(BadRequest, raised))).toEqual(new BadRequest({ field: "name", message: "Name is taken" }));
		},
	);
});
describe("a declared rejection cannot carry the invalidInput mark", () => {
	for (const mark of [true, false, "yes"]) {
		trpc.it(`strips the declared invalidInput value ${mark}`, [profileInputs()], function* ({ rejection, rejectMutation, exchanges }) {
			const error = yield* rejectMutation("declared", { mark });
			expect(exchanges.at(-1)?.status).toBe(400);
			expect(exchanges.at(-1)?.body).not.toContain("invalidInput");
			expect(rejection(error)).toEqual(Option.some({ _tag: "BadRequest", message: "Declared" }));
		});
	}

	trpc.it("strips the mark from a RejectionError constructed with it", [profileInputs()], function* ({ rejection, rejectMutation, exchanges }) {
		const error = yield* rejectMutation("constructed");
		expect(exchanges.at(-1)?.status).toBe(400);
		expect(exchanges.at(-1)?.body).not.toContain("invalidInput");
		expect(rejection(error)).toEqual(Option.some({ _tag: "BadRequest", message: "Declared" }));
	});
});
