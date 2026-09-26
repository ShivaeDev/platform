import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Effect, Option, Schema } from "effect";
import { afterAll, describe, expect, it } from "vitest";
import { decodeRejection, rejectionOf } from "../src/client.ts";
import { RejectionError, rejectWith } from "../src/index.ts";
import { failureOf, inProcess, procedure, runtime, t } from "./support/http.ts";

class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", { message: Schema.String, field: Schema.optionalKey(Schema.String) }) {}

const Address = Schema.Struct({ city: Schema.NonEmptyString });
const Profile = Schema.Struct({ name: Schema.NonEmptyString, address: Address, tags: Schema.Array(Schema.NonEmptyString) });
const Range = Schema.Struct({ from: Schema.Number, to: Schema.Number }).check(
	Schema.makeFilter(({ from, to }) => from <= to || "from must not be after to"),
);

const router = t.router({
	save: procedure.input(Profile).mutation(function* ({ name }) {
		if (name === "taken") return yield* Effect.fail(new BadRequest({ message: "Name is taken", field: "name" })).pipe(rejectWith(BadRequest));
		return name;
	}),
	range: procedure.input(Range).query(function* ({ from, to }) {
		yield* Effect.void;
		return to - from;
	}),
});

const http = inProcess(router);
const client = createTRPCClient<typeof router>({ links: [httpBatchLink(http)] });
const valid = { name: "Ada", address: { city: "London" }, tags: ["admin"] };

afterAll(() => runtime.dispose());

describe("input validation failures cross as BadRequest field rejections", () => {
	it("names the first issue's field with a dotted path", async () => {
		const error = await failureOf(client.save.mutate({ ...valid, address: { city: "" } }));
		const rejection = Option.getOrThrow(rejectionOf(error));

		expect(http.exchanges.at(-1)?.status).toBe(400);
		expect(error).toMatchObject({ message: rejection.message, data: { code: "BAD_REQUEST", httpStatus: 400, path: "save" } });
		expect(rejection).toEqual({ _tag: "BadRequest", field: "address.city", message: expect.any(String), invalidInput: true });
		expect(Option.getOrThrow(decodeRejection(BadRequest)(error))).toBeInstanceOf(BadRequest);
	});

	it("keeps array indexes in the path", async () => {
		const error = await failureOf(client.save.mutate({ ...valid, tags: ["admin", ""] }));

		expect(rejectionOf(error)).toMatchObject(Option.some({ _tag: "BadRequest", field: "tags.1" }));
	});

	it("omits the field when the issue concerns the whole input", async () => {
		const error = await failureOf(client.range.query({ from: 2, to: 1 }));

		expect(rejectionOf(error)).toEqual(Option.some({ _tag: "BadRequest", message: "from must not be after to", invalidInput: true }));
		expect(error).toMatchObject({ message: "from must not be after to", data: { code: "BAD_REQUEST", httpStatus: 400 } });
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
		expect(rejectionOf(raised)).toEqual(Option.some({ _tag: "BadRequest", message: "Name is taken", field: "name" }));
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
		expect(Option.getOrThrow(decodeRejection(BadRequest)(raised))).toEqual(new BadRequest({ message: "Name is taken", field: "name" }));
	});
});

class Spoofed extends Schema.TaggedError<Spoofed>()("BadRequest", { message: Schema.String, invalidInput: Schema.Unknown }) {}

const Mark = Schema.Struct({ mark: Schema.Union([Schema.Boolean, Schema.String]) });

const rejectSpoofed =
	rejectWith<
		// @ts-expect-error A declared rejection may not encode the reserved invalidInput field.
		typeof Spoofed
	>(Spoofed);

const spoofing = t.router({
	declared: procedure.input(Mark).mutation(function* ({ mark }) {
		return yield* Effect.fail(new Spoofed({ message: "Declared", invalidInput: mark })).pipe(rejectSpoofed);
	}),
	constructed: procedure.mutation(function* () {
		return yield* Effect.fail(new RejectionError({ _tag: "BadRequest", message: "Declared", invalidInput: true }));
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
