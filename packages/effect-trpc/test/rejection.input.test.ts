import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Effect, Option, Schema } from "effect";
import { afterAll, describe, expect, it } from "vitest";
import { decodeRejection, rejectionOf } from "#client.ts";
import { RejectionError, rejectWith } from "#index.ts";
import { failureOf, inProcess, procedure, runtime, t } from "#test/support/http.ts";

class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", { field: Schema.optionalKey(Schema.String), message: Schema.String }) {}

const Address = Schema.Struct({ city: Schema.NonEmptyString });
const Profile = Schema.Struct({ address: Address, name: Schema.NonEmptyString, tags: Schema.Array(Schema.NonEmptyString) });
const Range = Schema.Struct({ from: Schema.Number, to: Schema.Number }).check(
	Schema.makeFilter(({ from, to }) => from <= to || "from must not be after to"),
);

const router = t.router({
	range: procedure.input(Range).query(function* ({ from, to }) {
		yield* Effect.void;
		return to - from;
	}),
	save: procedure.input(Profile).mutation(function* ({ name }) {
		if (name === "taken") {
			return yield* Effect.fail(new BadRequest({ field: "name", message: "Name is taken" })).pipe(rejectWith(BadRequest));
		}
		return name;
	}),
});

const http = inProcess(router);
const client = createTRPCClient<typeof router>({ links: [httpBatchLink(http)] });
const valid = { address: { city: "London" }, name: "Ada", tags: ["admin"] };

afterAll(() => runtime.dispose());

describe("input validation failures cross as BadRequest field rejections", () => {
	it("names the first issue's field with a dotted path", async () => {
		const error = await failureOf(client.save.mutate({ ...valid, address: { city: "" } }));
		const rejection = Option.getOrThrow(rejectionOf(error));

		expect(http.exchanges.at(-1)?.status).toBe(400);
		expect(error).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400, path: "save" }, message: rejection.message });
		expect(rejection).toEqual({ _tag: "BadRequest", field: "address.city", invalidInput: true, message: expect.any(String) });
		expect(Option.getOrThrow(decodeRejection(BadRequest)(error))).toBeInstanceOf(BadRequest);
	});

	it("keeps array indexes in the path", async () => {
		const error = await failureOf(client.save.mutate({ ...valid, tags: ["admin", ""] }));

		expect(rejectionOf(error)).toMatchObject(Option.some({ _tag: "BadRequest", field: "tags.1" }));
	});

	it("omits the field when the issue concerns the whole input", async () => {
		const error = await failureOf(client.range.query({ from: 2, to: 1 }));

		expect(rejectionOf(error)).toEqual(Option.some({ _tag: "BadRequest", invalidInput: true, message: "from must not be after to" }));
		expect(error).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 }, message: "from must not be after to" });
	});

	it("is marked as invalid input, unlike a BadRequest with a field that the procedure raises", async () => {
		const invalid = await failureOf(client.save.mutate({ ...valid, name: "" }));
		const invalidBody = http.exchanges.at(-1)?.body;
		const raised = await failureOf(client.save.mutate({ ...valid, name: "taken" }));
		const raisedBody = http.exchanges.at(-1)?.body;

		expect(invalidBody).toContain('"invalidInput":true');
		expect(raisedBody).not.toContain("invalidInput");
		expect(Object.keys(Option.getOrThrow(rejectionOf(invalid))).sort()).toEqual(["_tag", "field", "invalidInput", "message"]);
		expect(Option.map(rejectionOf(invalid), ({ invalidInput }) => invalidInput)).toEqual(Option.some(true));
		expect(rejectionOf(raised)).toEqual(Option.some({ _tag: "BadRequest", field: "name", message: "Name is taken" }));
		expect(Option.map(rejectionOf(raised), ({ invalidInput }) => invalidInput)).toEqual(Option.some(undefined));
		expect(invalid).toMatchObject({
			data: { code: "BAD_REQUEST", httpStatus: 400, rejection: { _tag: "BadRequest", field: "name", invalidInput: true } },
		});
		expect(raised).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 } });
		expect(await client.save.mutate(valid)).toBe("Ada");
	});

	it("still decodes as the declared BadRequest, so clients that ignore the mark are unchanged", async () => {
		const invalid = await failureOf(client.save.mutate({ ...valid, name: "" }));
		const raised = await failureOf(client.save.mutate({ ...valid, name: "taken" }));

		expect(Option.getOrThrow(decodeRejection(BadRequest)(invalid))).toMatchObject({ _tag: "BadRequest", field: "name" });
		expect(Option.getOrThrow(decodeRejection(BadRequest)(raised))).toEqual(new BadRequest({ field: "name", message: "Name is taken" }));
	});
});

class Spoofed extends Schema.TaggedError<Spoofed>()("BadRequest", { invalidInput: Schema.Unknown, message: Schema.String }) {}

const Mark = Schema.Struct({ mark: Schema.Union([Schema.Boolean, Schema.String]) });

const rejectSpoofed: <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, Exclude<E, Spoofed> | RejectionError, R> = Reflect.apply(
	rejectWith,
	undefined,
	[Spoofed],
);

const spoofing = t.router({
	constructed: procedure.mutation(function* () {
		return yield* Effect.fail(new RejectionError({ _tag: "BadRequest", invalidInput: true, message: "Declared" }));
	}),
	declared: procedure.input(Mark).mutation(function* ({ mark }) {
		return yield* Effect.fail(new Spoofed({ invalidInput: mark, message: "Declared" })).pipe(rejectSpoofed);
	}),
});

const spoofingHttp = inProcess(spoofing);
const spoofingClient = createTRPCClient<typeof spoofing>({ links: [httpBatchLink(spoofingHttp)] });

describe("a declared rejection cannot carry the invalidInput mark", () => {
	it.each([true, false, "yes"])("sends a declared invalidInput of %j without the key", async (mark) => {
		const error = await failureOf(spoofingClient.declared.mutate({ mark }));

		expect(spoofingHttp.exchanges.at(-1)?.status).toBe(400);
		expect(spoofingHttp.exchanges.at(-1)?.body).not.toContain("invalidInput");
		expect(rejectionOf(error)).toEqual(Option.some({ _tag: "BadRequest", message: "Declared" }));
	});

	it("strips the mark from a RejectionError constructed with it", async () => {
		const error = await failureOf(spoofingClient.constructed.mutate());

		expect(spoofingHttp.exchanges.at(-1)?.status).toBe(400);
		expect(spoofingHttp.exchanges.at(-1)?.body).not.toContain("invalidInput");
		expect(rejectionOf(error)).toEqual(Option.some({ _tag: "BadRequest", message: "Declared" }));
	});
});
