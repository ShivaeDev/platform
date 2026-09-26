import { makeEffectTRPC, makeRequestServices, rejectionFormatter, rejectWith } from "@shivaedev/effect-trpc";
import { decodeRejection, rejectionOf } from "@shivaedev/effect-trpc/client";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Effect, Layer, ManagedRuntime, Option, Schema } from "effect";
import superjson from "superjson";
import { afterAll, expect, test } from "vitest";
import { AuthUnavailable, BadRequest, Conflict, NotFound, PreconditionFailed, rejectedField } from "../src/errors.ts";

const Rejection = Schema.Union([NotFound, BadRequest, Conflict, PreconditionFailed, AuthUnavailable]);

const failures = {
	required: new BadRequest({ message: "Name is required", field: "name" }),
	malformed: new BadRequest({ message: "Malformed" }),
	taken: new Conflict({ message: "Name is taken", field: "name" }),
	stale: new PreconditionFailed({ message: "Profile changed" }),
	missing: new NotFound({ message: "No profile" }),
	outage: new AuthUnavailable({ message: "Sessions are unavailable" }),
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
			url: "http://localhost/trpc",
			transformer: superjson,
			fetch: (input, init) =>
				fetchRequestHandler({
					endpoint: "/trpc",
					req: new Request(input, { ...init, signal: init?.signal ?? null }),
					router,
					createContext: () => ({}),
				}),
		}),
	],
});

const rename = async (name: string): Promise<unknown> => {
	try {
		return await client.rename.mutate({ name });
	} catch (error) {
		return error;
	}
};

afterAll(() => runtime.dispose());

test("taxonomy errors cross tRPC HTTP as rejections whose field reaches the form", async () => {
	const taken = await rename("taken");

	expect(taken).toMatchObject({ data: { code: "CONFLICT", httpStatus: 409 } });
	expect(Option.flatMap(rejectionOf(taken), rejectedField)).toEqual(Option.some({ field: "name", message: "Name is taken" }));
	expect(Option.getOrThrow(decodeRejection(Rejection)(taken))).toBeInstanceOf(Conflict);
	expect(Option.flatMap(rejectionOf(await rename("required")), rejectedField)).toEqual(Option.some({ field: "name", message: "Name is required" }));
});

test("taxonomy errors without a field keep their code and are not field rejections", async () => {
	const [malformed, stale, missing, outage] = await Promise.all([rename("malformed"), rename("stale"), rename("missing"), rename("outage")]);

	expect([malformed, stale, missing, outage].map((error) => Option.flatMap(rejectionOf(error), rejectedField))).toEqual([
		Option.none(),
		Option.none(),
		Option.none(),
		Option.none(),
	]);
	expect(outage).toMatchObject({ data: { code: "SERVICE_UNAVAILABLE", httpStatus: 503, rejection: { _tag: "AuthUnavailable" } } });
	expect(malformed).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400, rejection: { _tag: "BadRequest", message: "Malformed" } } });
	expect(stale).toMatchObject({ data: { code: "PRECONDITION_FAILED", httpStatus: 412 } });
	expect(Option.getOrThrow(decodeRejection(Rejection)(missing))).toBeInstanceOf(NotFound);
	expect(missing).toMatchObject({ data: { code: "NOT_FOUND", httpStatus: 404 } });
});

test("an input the procedure's schema rejects reaches the form as a BadRequest field rejection", async () => {
	const invalid = await rename("");

	expect(invalid).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 } });
	expect(Option.getOrThrow(decodeRejection(Rejection)(invalid))).toBeInstanceOf(BadRequest);
	expect(Option.map(Option.flatMap(rejectionOf(invalid), rejectedField), ({ field }) => field)).toEqual(Option.some("name"));
});
