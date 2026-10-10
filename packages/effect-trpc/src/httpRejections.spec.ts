import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { Effect, Option, Schema } from "effect";
import { afterAll, describe, expect, it } from "vitest";
import { decodeRejection, rejectionOf } from "#client/rejection.ts";
import { notFound } from "#errors.ts";
import { rejectWith } from "#rejection.ts";
import { failureOf, inProcess, procedure, runtime, t } from "#test/http.ts";

const described = { message: Schema.String };
const perField = { field: Schema.optionalKey(Schema.String), message: Schema.String };

class NotFound extends Schema.TaggedError<NotFound>()("NotFound", described) {}
class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", described) {}
class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", described) {}
class Conflict extends Schema.TaggedError<Conflict>()("Conflict", perField) {}
class PreconditionFailed extends Schema.TaggedError<PreconditionFailed>()("PreconditionFailed", described) {}
class TooManyRequests extends Schema.TaggedError<TooManyRequests>()("TooManyRequests", described) {}
class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", perField) {}
class Throttled extends Schema.TaggedError<Throttled>()("Throttled", { retryAfter: Schema.NumberFromString }) {}
class AuthUnavailable extends Schema.TaggedError<AuthUnavailable>()("AuthUnavailable", described) {}
class Undeclared extends Schema.TaggedError<Undeclared>()("Undeclared", { field: Schema.String, message: Schema.String }) {}

const Rejection = Schema.Union([
	NotFound,
	Unauthorized,
	Forbidden,
	Conflict,
	PreconditionFailed,
	TooManyRequests,
	BadRequest,
	AuthUnavailable,
	Throttled,
]);
const SECRET = "postgres://app:hunter2@db.internal/app";

const failures = {
	busy: new TooManyRequests({ message: "Slow down" }),
	empty: new BadRequest({ field: "name", message: "Name is required" }),
	forbidden: new Forbidden({ message: "Not yours" }),
	notFound: new NotFound({ message: "No profile" }),
	outage: new AuthUnavailable({ message: "Sessions are unavailable" }),
	stale: new PreconditionFailed({ message: "Profile changed" }),
	taken: new Conflict({ field: "name", message: "Name is taken" }),
	throttled: new Throttled({ retryAfter: 30 }),
	unauthorized: new Unauthorized({ message: "Sign in" }),
	undeclared: new Undeclared({ field: "password", message: SECRET }),
};

function rename(name: string) {
	const failure = Object.entries(failures).find(([key]) => key === name)?.[1];
	return failure === undefined ? Effect.succeed(`renamed:${name}`) : Effect.fail(failure);
}

const router = t.router({
	defect: procedure.query(function* () {
		return yield* Effect.die(new Error(SECRET));
	}),
	explicit: procedure.query(function* () {
		return yield* notFound("Explicitly missing");
	}),
	rename: procedure.input(Schema.Struct({ name: Schema.String })).mutation(function* ({ name }) {
		return yield* rename(name).pipe(rejectWith(Rejection));
	}),
	throttle: procedure.mutation(function* () {
		return yield* rename("throttled").pipe(rejectWith(Throttled, { code: () => "TOO_MANY_REQUESTS" }));
	}),
});

const http = inProcess(router);
const client = createTRPCClient<typeof router>({ links: [httpBatchLink(http)] });
const { exchanges } = http;

afterAll(() => runtime.dispose());

describe("declared rejections over tRPC HTTP with superjson", () => {
	it("cross as their encoded value and decode to the declared class with its field", async () => {
		const error = await failureOf(client.rename.mutate({ name: "taken" }));

		expect(error).toBeInstanceOf(TRPCClientError);
		expect(error).toMatchObject({ data: { code: "CONFLICT", httpStatus: 409, path: "rename" }, message: "Name is taken" });
		expect(rejectionOf(error)).toEqual(Option.some({ _tag: "Conflict", field: "name", message: "Name is taken" }));
		const decoded = decodeRejection(Rejection)(error);
		expect(Option.getOrThrow(decoded)).toBeInstanceOf(Conflict);
		expect(Option.getOrThrow(decoded)).toMatchObject({ field: "name", message: "Name is taken" });
	});

	it("encode their fields on the server and decode them on the client", async () => {
		const error = await failureOf(client.rename.mutate({ name: "throttled" }));

		expect(error).toMatchObject({ message: "Throttled" });
		expect(exchanges.at(-1)?.body).toContain('"rejection":{"_tag":"Throttled","retryAfter":"30"}');
		expect(Option.getOrThrow(decodeRejection(Throttled)(error)).retryAfter).toBe(30);
		expect(rejectionOf(error)).toEqual(Option.some({ _tag: "Throttled", retryAfter: "30" }));
	});

	it.each([
		["notFound", "NOT_FOUND", 404],
		["unauthorized", "UNAUTHORIZED", 401],
		["forbidden", "FORBIDDEN", 403],
		["taken", "CONFLICT", 409],
		["stale", "PRECONDITION_FAILED", 412],
		["busy", "TOO_MANY_REQUESTS", 429],
		["empty", "BAD_REQUEST", 400],
		["outage", "SERVICE_UNAVAILABLE", 503],
		["throttled", "BAD_REQUEST", 400],
	])("send %s with code %s and HTTP status %i", async (name, code, status) => {
		const error = await failureOf(client.rename.mutate({ name }));

		expect(exchanges.at(-1)?.status).toBe(status);
		expect(error).toMatchObject({ data: { code, httpStatus: status } });
		expect(Option.isSome(decodeRejection(Rejection)(error))).toBe(true);
	});

	it("take the code from the option when one is given", async () => {
		const error = await failureOf(client.throttle.mutate());

		expect(exchanges.at(-1)?.status).toBe(429);
		expect(error).toMatchObject({ data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 } });
		expect(rejectionOf(error)).toEqual(Option.some({ _tag: "Throttled", retryAfter: "30" }));
	});

	it("keep each rejection and code in a mixed batch", async () => {
		const before = exchanges.length;
		const [renamed, missing, taken] = await Promise.allSettled([
			client.rename.mutate({ name: "Ada" }),
			client.rename.mutate({ name: "notFound" }),
			client.rename.mutate({ name: "taken" }),
		]);

		expect(exchanges.length).toBe(before + 1);
		expect(exchanges.at(-1)?.status).toBe(207);
		expect(renamed).toEqual({ status: "fulfilled", value: "renamed:Ada" });
		expect(missing).toMatchObject({ reason: { data: { code: "NOT_FOUND", httpStatus: 404 } }, status: "rejected" });
		expect(taken).toMatchObject({ reason: { data: { code: "CONFLICT", httpStatus: 409 } }, status: "rejected" });
		const reasons = [missing, taken].flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
		expect(reasons.map((reason) => Option.map(decodeRejection(Rejection)(reason), ({ _tag }) => _tag))).toEqual([
			Option.some("NotFound"),
			Option.some("Conflict"),
		]);
	});
});

describe("everything else stays opaque", () => {
	it("sends a failure outside the declared schema as a redacted internal error", async () => {
		const error = await failureOf(client.rename.mutate({ name: "undeclared" }));

		expect(error).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 }, message: "Internal server error" });
		expect(rejectionOf(error)).toEqual(Option.none());
		expect(exchanges.at(-1)?.body).not.toContain("hunter2");
		expect(exchanges.at(-1)?.body).not.toContain('"rejection"');
	});

	it("redacts defects and attaches no rejection", async () => {
		const error = await failureOf(client.defect.query());

		expect(error).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" }, message: "Internal server error" });
		expect(rejectionOf(error)).toEqual(Option.none());
		expect(exchanges.at(-1)?.body).not.toContain("hunter2");
	});

	it("leaves explicit TRPCErrors without a rejection", async () => {
		const error = await failureOf(client.explicit.query());

		expect(error).toMatchObject({ data: { code: "NOT_FOUND" }, message: "Explicitly missing" });
		expect(rejectionOf(error)).toEqual(Option.none());
	});

	it("does not decode a rejection the client schema does not declare", async () => {
		const error = await failureOf(client.rename.mutate({ name: "taken" }));

		expect(decodeRejection(Schema.Union([NotFound, Forbidden]))(error)).toEqual(Option.none());
		expect(Option.isSome(rejectionOf(error))).toBe(true);
	});

	it("reads only tagged rejections from error data", () => {
		expect(rejectionOf({ data: { rejection: { field: "name", message: "Untagged" } } })).toEqual(Option.none());
		expect(rejectionOf({ data: { rejection: { _tag: 1 } } })).toEqual(Option.none());
		expect(rejectionOf({ data: { rejection: { _tag: "BadRequest", invalidInput: "yes" } } })).toEqual(Option.none());
		expect(rejectionOf({ data: { rejection: "Conflict" } })).toEqual(Option.none());
		expect(rejectionOf({ rejection: { _tag: "Conflict" } })).toEqual(Option.none());
		expect(rejectionOf(new Error("Conflict"))).toEqual(Option.none());
		expect(rejectionOf(null)).toEqual(Option.none());
	});
});
