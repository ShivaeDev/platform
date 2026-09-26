import { TRPCError } from "@trpc/server";
import { Cause, Effect, Exit, Schema, SchemaGetter } from "effect";
import { describe, expect, it } from "vitest";
import { RejectionError, rejectionCode, rejectWith, withRejection } from "../src/index.ts";

class Conflict extends Schema.TaggedError<Conflict>()("Conflict", { message: Schema.String, field: Schema.String }) {}
class Other extends Schema.TaggedError<Other>()("Other", { message: Schema.String }) {}
const NeverEncoded = Schema.String.pipe(
	Schema.decodeTo(Schema.Number, { decode: SchemaGetter.Number(), encode: SchemaGetter.forbidden(() => "Counts are never sent") }),
);
class Unencodable extends Schema.TaggedError<Unencodable>()("Unencodable", { count: NeverEncoded }) {}

const shape = { message: "Name is taken", code: -32009, data: { code: "CONFLICT", httpStatus: 409, requestId: "r-1" } };

describe("rejectWith", () => {
	it("fails with a RejectionError carrying only the encoded declared fields", async () => {
		const error = await Effect.runPromise(
			Effect.flip(Effect.fail(new Conflict({ message: "Name is taken", field: "name" })).pipe(rejectWith(Conflict))),
		);

		expect(error).toBeInstanceOf(TRPCError);
		expect(error).toMatchObject({ code: "CONFLICT", message: "Name is taken", cause: undefined });
		expect(error.rejection).toStrictEqual({ _tag: "Conflict", message: "Name is taken", field: "name" });
	});

	it("leaves successes, undeclared failures and defects untouched", async () => {
		const declared = rejectWith(Conflict);
		const other = new Other({ message: "Elsewhere" });

		expect(await Effect.runPromise(Effect.succeed(1).pipe(declared))).toBe(1);
		expect(await Effect.runPromise(Effect.flip(Effect.fail(other).pipe(declared)))).toBe(other);
		const defect = await Effect.runPromiseExit(Effect.die(new Conflict({ message: "Died", field: "name" })).pipe(declared));
		expect(Exit.isFailure(defect) && Cause.hasDies(defect.cause) && !Cause.hasFails(defect.cause)).toBe(true);
	});

	it("turns a value its schema cannot encode into a defect", async () => {
		const exit = await Effect.runPromiseExit(Effect.fail(new Unencodable({ count: 1 })).pipe(rejectWith(Unencodable)));

		expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause) && !Cause.hasFails(exit.cause)).toBe(true);
	});
});

describe("rejection codes and shapes", () => {
	it("maps the Platform taxonomy tags and defaults to BAD_REQUEST", () => {
		expect(
			["NotFound", "Unauthorized", "Forbidden", "Conflict", "PreconditionFailed", "TooManyRequests", "AuthUnavailable", "BadRequest", "toString"].map(
				rejectionCode,
			),
		).toEqual([
			"NOT_FOUND",
			"UNAUTHORIZED",
			"FORBIDDEN",
			"CONFLICT",
			"PRECONDITION_FAILED",
			"TOO_MANY_REQUESTS",
			"SERVICE_UNAVAILABLE",
			"BAD_REQUEST",
			"BAD_REQUEST",
		]);
	});

	it("uses the tag as the message when the rejection has none", () => {
		expect(new RejectionError({ _tag: "Throttled", retryAfter: "30" })).toMatchObject({ code: "BAD_REQUEST", message: "Throttled" });
		expect(new RejectionError({ _tag: "Throttled", message: 1 })).toMatchObject({ message: "Throttled" });
	});

	it("adds the rejection to an application's own shape and leaves other errors' shapes alone", () => {
		const rejection = { _tag: "Conflict", message: "Name is taken", field: "name" };

		expect(withRejection(shape, new RejectionError(rejection))).toEqual({ ...shape, data: { ...shape.data, rejection } });
		expect(withRejection(shape, new TRPCError({ code: "CONFLICT", message: "Name is taken" }))).toBe(shape);
	});
});
