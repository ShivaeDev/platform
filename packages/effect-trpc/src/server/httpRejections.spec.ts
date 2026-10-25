import { TRPCClientError } from "@trpc/client";
import { Option, Schema } from "effect";
import { describe, expect } from "vitest";
import { declaredRejections } from "#test/declaredRejections.ts";
import { Conflict, Forbidden, NotFound, Rejection, Throttled } from "#test/rejectionSchemas.ts";
import { trpc } from "#test/routerStory.ts";

const RETRY_AFTER = 30;

describe("declared rejections over tRPC HTTP with superjson", () => {
	trpc.it(
		"cross as their encoded value and decode to the declared class with its field",
		[declaredRejections()],
		function* ({ rejection, decode, rejectMutation }) {
			const error = yield* rejectMutation("rename", { name: "taken" });
			expect(error).toBeInstanceOf(TRPCClientError);
			expect(error).toMatchObject({ data: { code: "CONFLICT", httpStatus: 409, path: "rename" }, message: "Name is taken" });
			expect(rejection(error)).toEqual(Option.some({ _tag: "Conflict", field: "name", message: "Name is taken" }));
			const decoded = decode(Rejection, error);
			expect(Option.getOrThrow(decoded)).toBeInstanceOf(Conflict);
			expect(Option.getOrThrow(decoded)).toMatchObject({ field: "name", message: "Name is taken" });
		},
	);
	trpc.it(
		"encode their fields on the server and decode them on the client",
		[declaredRejections(RETRY_AFTER)],
		function* ({ rejection, decode, rejectMutation, exchanges }) {
			const error = yield* rejectMutation("rename", { name: "throttled" });
			expect(error).toMatchObject({ message: "Throttled" });
			expect(exchanges.at(-1)?.body).toContain('"rejection":{"_tag":"Throttled","retryAfter":"30"}');
			expect(Option.getOrThrow(decode(Throttled, error)).retryAfter).toBe(RETRY_AFTER);
			expect(rejection(error)).toEqual(Option.some({ _tag: "Throttled", retryAfter: "30" }));
		},
	);
	for (const [name, code, status] of [
		["notFound", "NOT_FOUND", 404],
		["unauthorized", "UNAUTHORIZED", 401],
		["forbidden", "FORBIDDEN", 403],
		["taken", "CONFLICT", 409],
		["stale", "PRECONDITION_FAILED", 412],
		["busy", "TOO_MANY_REQUESTS", 429],
		["empty", "BAD_REQUEST", 400],
		["outage", "SERVICE_UNAVAILABLE", 503],
		["throttled", "BAD_REQUEST", 400],
	] as const) {
		trpc.it(`sends ${name} with ${code} and HTTP ${status}`, [declaredRejections()], function* ({ decode, rejectMutation, exchanges }) {
			const error = yield* rejectMutation("rename", { name });
			expect(exchanges.at(-1)?.status).toBe(status);
			expect(error).toMatchObject({ data: { code, httpStatus: status } });
			expect(Option.isSome(decode(Rejection, error))).toBe(true);
		});
	}

	trpc.it("take the code from the option when one is given", [declaredRejections()], function* ({ rejection, rejectMutation, exchanges }) {
		const error = yield* rejectMutation("throttle");
		expect(exchanges.at(-1)?.status).toBe(429);
		expect(error).toMatchObject({ data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 } });
		expect(rejection(error)).toEqual(Option.some({ _tag: "Throttled", retryAfter: "30" }));
	});
	trpc.it("keep each rejection and code in a mixed batch", [declaredRejections()], function* ({ decode, exchanges, batch }) {
		const before = exchanges.length;
		const [renamed, missing, taken] = yield* batch([
			{ input: { name: "Ada" }, path: "rename" },
			{ input: { name: "notFound" }, path: "rename" },
			{ input: { name: "taken" }, path: "rename" },
		]);
		expect(exchanges.length).toBe(before + 1);
		expect(exchanges.at(-1)?.status).toBe(207);
		expect(renamed).toEqual({ status: "fulfilled", value: "renamed:Ada" });
		expect(missing).toMatchObject({ reason: { data: { code: "NOT_FOUND", httpStatus: 404 } }, status: "rejected" });
		expect(taken).toMatchObject({ reason: { data: { code: "CONFLICT", httpStatus: 409 } }, status: "rejected" });
		const reasons = [missing, taken].flatMap((result) => (result?.status === "rejected" ? [result.reason] : []));
		expect(reasons.map((reason) => Option.map(decode(Rejection, reason), ({ _tag }) => _tag))).toEqual([
			Option.some("NotFound"),
			Option.some("Conflict"),
		]);
	});
});
describe("everything else stays opaque", () => {
	trpc.it(
		"sends a failure outside the declared schema as a redacted internal error",
		[declaredRejections()],
		function* ({ rejection, rejectMutation, exchanges }) {
			const error = yield* rejectMutation("rename", { name: "undeclared" });
			expect(error).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 }, message: "Internal server error" });
			expect(rejection(error)).toEqual(Option.none());
			expect(exchanges.at(-1)?.body).not.toContain("hunter2");
			expect(exchanges.at(-1)?.body).not.toContain('"rejection"');
		},
	);
	trpc.it("redacts defects and attaches no rejection", [declaredRejections()], function* ({ rejection, rejectQuery, exchanges }) {
		const error = yield* rejectQuery("defect");
		expect(error).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" }, message: "Internal server error" });
		expect(rejection(error)).toEqual(Option.none());
		expect(exchanges.at(-1)?.body).not.toContain("hunter2");
	});
	trpc.it("leaves explicit TRPCErrors without a rejection", [declaredRejections()], function* ({ rejection, rejectQuery }) {
		const error = yield* rejectQuery("explicit");
		expect(error).toMatchObject({ data: { code: "NOT_FOUND" }, message: "Explicitly missing" });
		expect(rejection(error)).toEqual(Option.none());
	});
	trpc.it(
		"does not decode a rejection the client schema does not declare",
		[declaredRejections()],
		function* ({ rejection, decode, rejectMutation }) {
			const error = yield* rejectMutation("rename", { name: "taken" });
			expect(decode(Schema.Union([NotFound, Forbidden]), error)).toEqual(Option.none());
			expect(Option.isSome(rejection(error))).toBe(true);
		},
	);
	trpc.it("rejects malformed carriers of an HTTP rejection", [declaredRejections()], function* ({ rejection, rejectMutation }) {
		const error = yield* rejectMutation("rename", { name: "taken" });
		const received = Option.getOrThrow(rejection(error));
		expect(received).toMatchObject({ _tag: "Conflict" });
		const { _tag, ...untagged } = received;
		for (const malformed of [
			{ data: { rejection: untagged } },
			{ data: { rejection: { ...received, _tag: 1 } } },
			{ data: { rejection: { ...received, _tag: "BadRequest", invalidInput: "yes" } } },
			{ data: { rejection: _tag } },
			{ rejection: received },
			new Error(_tag),
			null,
		]) {
			expect(rejection(malformed)).toEqual(Option.none());
		}
	});
});
