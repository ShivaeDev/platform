import { TRPCError } from "@trpc/server";
import { Option } from "effect";
import { expect } from "vitest";
import { RejectionError } from "#rejection.ts";
import { Conflict, other, rejectionRules } from "#test/rejectionRules.ts";
import { customErrorShape, requestIs, trpc } from "#test/routerStory.ts";

trpc.it("encodes only declared fields in a RejectionError", [rejectionRules()], function* ({ rejectCaller }) {
	const error = yield* rejectCaller("conflict");
	expect(error).toBeInstanceOf(TRPCError);
	expect(error).toBeInstanceOf(RejectionError);
	expect(error).toMatchObject({ cause: undefined, code: "CONFLICT", message: "Name is taken" });
	if (!(error instanceof RejectionError)) {
		throw new Error("Expected an encoded rejection");
	}
	expect(error.rejection).toStrictEqual({ _tag: "Conflict", field: "name", message: "Name is taken" });
});
trpc.it("leaves successes, undeclared failures and defects untouched", [rejectionRules()], function* ({ query, rejectQuery, mapped, rejection }) {
	expect(yield* query("success")).toBe(1);
	const failure = yield* rejectQuery("other");
	expect(rejection(failure)).toEqual(Option.none());
	expect(mapped.find(({ path }) => path === "other")?.error).toBe(other);
	const defect = yield* rejectQuery("die");
	expect(rejection(defect)).toEqual(Option.none());
	expect(mapped).toContainEqual({ error: expect.any(Conflict), origin: "defect", path: "die" });
});
trpc.it("turns an unencodable rejection into a defect", [rejectionRules()], function* ({ rejectQuery, mapped, rejection }) {
	const error = yield* rejectQuery("unencodable");
	expect(error).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" }, message: "Internal server error" });
	expect(rejection(error)).toEqual(Option.none());
	expect(mapped).toEqual([{ error: expect.anything(), origin: "defect", path: "unencodable" }]);
});
for (const [tag, code] of [
	["NotFound", "NOT_FOUND"],
	["Unauthorized", "UNAUTHORIZED"],
	["Forbidden", "FORBIDDEN"],
	["Conflict", "CONFLICT"],
	["PreconditionFailed", "PRECONDITION_FAILED"],
	["TooManyRequests", "TOO_MANY_REQUESTS"],
	["AuthUnavailable", "SERVICE_UNAVAILABLE"],
	["ServiceUnavailable", "SERVICE_UNAVAILABLE"],
	["InternalServerError", "INTERNAL_SERVER_ERROR"],
	["BadRequest", "BAD_REQUEST"],
	["toString", "BAD_REQUEST"],
]) {
	trpc.it(`maps the ${tag} rejection to ${code}`, [rejectionRules()], function* ({ rejectQuery, rejection }) {
		const error = yield* rejectQuery("tag", { _tag: tag });
		expect(error).toMatchObject({ data: { code }, message: tag });
		expect(rejection(error)).toEqual(Option.some({ _tag: tag }));
	});
}
for (const input of [
	{ _tag: "Throttled", retryAfter: "30" },
	{ _tag: "Throttled", message: 1 },
]) {
	trpc.it(`uses the tag when the message is ${JSON.stringify(input)}`, [rejectionRules()], function* ({ rejectQuery }) {
		expect(yield* rejectQuery("tag", input)).toMatchObject({ data: { code: "BAD_REQUEST" }, message: "Throttled" });
	});
}
trpc.it(
	"adds a rejection to the application's own error shape",
	[rejectionRules(), customErrorShape(), requestIs("r-1")],
	function* ({ rejectQuery, formatting }) {
		expect(yield* rejectQuery("conflict")).toMatchObject({
			data: {
				code: "CONFLICT",
				httpStatus: 409,
				path: "conflict",
				rejection: { _tag: "Conflict", field: "name", message: "Name is taken" },
				requestId: "r-1",
			},
			message: "Name is taken",
		});
		expect(formatting).toHaveLength(1);
		expect(formatting[0]?.formatted).toEqual({
			...formatting[0]?.original,
			data: { ...formatting[0]?.original.data, rejection: { _tag: "Conflict", field: "name", message: "Name is taken" } },
		});
		expect(formatting[0]?.formatted).not.toBe(formatting[0]?.original);
	},
);
trpc.it(
	"leaves an ordinary transport error's shape untouched",
	[rejectionRules(), customErrorShape()],
	function* ({ rejectQuery, formatting, rejection }) {
		const error = yield* rejectQuery("explicit");
		expect(error).toMatchObject({ data: { code: "CONFLICT" }, message: "Name is taken" });
		expect(rejection(error)).toEqual(Option.none());
		expect(formatting).toHaveLength(1);
		expect(formatting[0]?.formatted).toBe(formatting[0]?.original);
	},
);
