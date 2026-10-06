import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Effect, Layer, ManagedRuntime, Option, Schema } from "effect";
import superjson from "superjson";
import { afterAll, expect, it } from "vitest";
import { makeEffectTRPC } from "@shivaedev/effect-trpc/adapter.ts";
import { decodeRejection, rejectionOf } from "@shivaedev/effect-trpc/client/rejection.ts";
import { rejectWith } from "@shivaedev/effect-trpc/rejection.ts";
import { rejectionFormatter } from "@shivaedev/effect-trpc/rejection-formatter.ts";
import { makeRequestServices } from "@shivaedev/effect-trpc/request-services.ts";
import { rejectedField } from "#errors/rejected-field.ts";
import { AuthUnavailable, BadRequest, Conflict, NotFound, PreconditionFailed, TooManyRequests } from "#errors/taxonomy.ts";

const Rejection = Schema.Union([NotFound, BadRequest, Conflict, PreconditionFailed, TooManyRequests, AuthUnavailable]);

const failures = {
	busy: new TooManyRequests({ message: "Slow down" }),
	malformed: new BadRequest({ message: "Malformed" }),
	missing: new NotFound({ message: "No profile" }),
	outage: new AuthUnavailable({ message: "Sessions are unavailable" }),
	required: new BadRequest({ field: "name", message: "Name is required" }),
	stale: new PreconditionFailed({ message: "Profile changed" }),
	taken: new Conflict({ field: "name", message: "Name is taken" }),
};

const runtime = ManagedRuntime.make(Layer.empty);
const t = initTRPC.create({ errorFormatter: rejectionFormatter, transformer: superjson });
const procedure = makeEffectTRPC({ runtime }).procedure(
	t.procedure,
	makeRequestServices(() => Layer.empty),
);
const router = t.router({
	rename: procedure.input(Schema.Struct({ name: Schema.NonEmptyString })).mutation(function* ({ name }) {
		const failure = Object.entries(failures).find(([key]) => key === name)?.[1];
		return yield* (failure === undefined ? Effect.succeed(name) : Effect.fail(failure)).pipe(rejectWith(Rejection));
	}),
});
const client = createTRPCClient<typeof router>({
	links: [
		httpBatchLink({
			fetch: (input, init) =>
				fetchRequestHandler({
					createContext: () => ({}),
					endpoint: "/trpc",
					req: new Request(input, { ...init, signal: init?.signal ?? null }),
					router,
				}),
			transformer: superjson,
			url: "http://localhost/trpc",
		}),
	],
});

async function rename(name: string): Promise<unknown> {
	try {
		return await client.rename.mutate({ name });
	} catch (error) {
		return error;
	}
}

afterAll(() => runtime.dispose());

it("taxonomy errors cross tRPC HTTP as rejections whose field reaches the form", async () => {
	const taken = await rename("taken");

	expect(taken).toMatchObject({ data: { code: "CONFLICT", httpStatus: 409 } });
	expect(Option.flatMap(rejectionOf(taken), rejectedField)).toEqual(Option.some({ field: "name", message: "Name is taken" }));
	expect(Option.getOrThrow(decodeRejection(Rejection)(taken))).toBeInstanceOf(Conflict);
	expect(Option.flatMap(rejectionOf(await rename("required")), rejectedField)).toEqual(Option.some({ field: "name", message: "Name is required" }));
});

it("taxonomy errors without a field keep their code and are not field rejections", async () => {
	const [malformed, stale, busy, missing, outage] = await Promise.all([
		rename("malformed"),
		rename("stale"),
		rename("busy"),
		rename("missing"),
		rename("outage"),
	]);

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

it("an input the procedure's schema rejects reaches the form as a BadRequest field rejection", async () => {
	const invalid = await rename("");

	expect(invalid).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 } });
	expect(Option.getOrThrow(decodeRejection(Rejection)(invalid))).toBeInstanceOf(BadRequest);
	expect(Option.map(Option.flatMap(rejectionOf(invalid), rejectedField), ({ field }) => field)).toEqual(Option.some("name"));
	expect(Option.map(rejectionOf(invalid), ({ invalidInput }) => invalidInput)).toEqual(Option.some(true));
	expect(Option.map(rejectionOf(await rename("required")), ({ invalidInput }) => invalidInput)).toEqual(Option.some(undefined));
});
