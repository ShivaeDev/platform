import { Effect, Option } from "effect";
import { expect } from "vitest";
import { decodeRejection, rejectionOf } from "@shivaedev/effect-trpc/client/rejection.ts";
import { rejectedField } from "#errors/rejected-field.ts";
import { BadRequest, Conflict, InternalServerError, NotFound, ServiceUnavailable, TooManyRequests } from "#errors/taxonomy.ts";
import { Rejection, trpc } from "#test/rpc/trpcStory.ts";

trpc.it("taxonomy errors cross tRPC HTTP as rejections whose field reaches the form", [], function* ({ rename }) {
	const taken = yield* rename("taken");
	expect(taken).toMatchObject({ data: { code: "CONFLICT", httpStatus: 409 } });
	expect(Option.flatMap(rejectionOf(taken), rejectedField)).toEqual(Option.some({ field: "name", message: "Name is taken" }));
	expect(Option.getOrThrow(decodeRejection(Rejection)(taken))).toBeInstanceOf(Conflict);
	expect(Option.flatMap(rejectionOf(yield* rename("required")), rejectedField)).toEqual(Option.some({ field: "name", message: "Name is required" }));
});
trpc.it("taxonomy errors without a field keep their code and are not field rejections", [], function* ({ rename }) {
	const [malformed, stale, busy, missing, outage] = yield* Effect.all(
		[rename("malformed"), rename("stale"), rename("busy"), rename("missing"), rename("outage")],
		{ concurrency: "unbounded" },
	);
	expect([malformed, stale, busy, missing, outage].map((error) => Option.flatMap(rejectionOf(error), rejectedField))).toEqual([
		Option.none(),
		Option.none(),
		Option.none(),
		Option.none(),
		Option.none(),
	]);
	expect(outage).toMatchObject({ data: { code: "SERVICE_UNAVAILABLE", httpStatus: 503, rejection: { _tag: "AuthUnavailable" } } });
	expect(malformed).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400, rejection: { _tag: "BadRequest", message: "Malformed" } } });
	expect(stale).toMatchObject({ data: { code: "PRECONDITION_FAILED", httpStatus: 412 } });
	expect(busy).toMatchObject({ data: { code: "TOO_MANY_REQUESTS", httpStatus: 429, rejection: { _tag: "TooManyRequests", message: "Slow down" } } });
	expect(Option.getOrThrow(decodeRejection(Rejection)(busy))).toBeInstanceOf(TooManyRequests);
	expect(Option.getOrThrow(decodeRejection(Rejection)(missing))).toBeInstanceOf(NotFound);
	expect(missing).toMatchObject({ data: { code: "NOT_FOUND", httpStatus: 404 } });
});
trpc.it("an input the procedure's schema rejects reaches the form as a BadRequest field rejection", [], function* ({ rename }) {
	const invalid = yield* rename("");
	expect(invalid).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 } });
	expect(Option.getOrThrow(decodeRejection(Rejection)(invalid))).toBeInstanceOf(BadRequest);
	expect(Option.map(Option.flatMap(rejectionOf(invalid), rejectedField), ({ field }) => field)).toEqual(Option.some("name"));
	expect(Option.map(rejectionOf(invalid), ({ invalidInput }) => invalidInput)).toEqual(Option.some(true));
	expect(Option.map(rejectionOf(yield* rename("required")), ({ invalidInput }) => invalidInput)).toEqual(Option.some(undefined));
});
trpc.it("general server taxonomy errors retain their declared type and HTTP status through tRPC", [], function* ({ rename }) {
	const internal = yield* rename("internal");
	const unavailable = yield* rename("unavailable");
	expect(internal).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, rejection: { _tag: "InternalServerError" } } });
	expect(unavailable).toMatchObject({ data: { code: "SERVICE_UNAVAILABLE", httpStatus: 503, rejection: { _tag: "ServiceUnavailable" } } });
	expect(Option.getOrThrow(decodeRejection(Rejection)(internal))).toBeInstanceOf(InternalServerError);
	expect(Option.getOrThrow(decodeRejection(Rejection)(unavailable))).toBeInstanceOf(ServiceUnavailable);
});
