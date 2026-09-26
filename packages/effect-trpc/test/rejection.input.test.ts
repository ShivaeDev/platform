import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Effect, Option, Schema } from "effect";
import { afterAll, describe, expect, it } from "vitest";
import { decodeRejection, rejectionOf } from "../src/client.ts";
import { rejectWith } from "../src/index.ts";
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
		expect(rejection).toEqual({ _tag: "BadRequest", field: "address.city", message: expect.any(String) });
		expect(Option.getOrThrow(decodeRejection(BadRequest)(error))).toBeInstanceOf(BadRequest);
	});

	it("keeps array indexes in the path", async () => {
		const error = await failureOf(client.save.mutate({ ...valid, tags: ["admin", ""] }));

		expect(rejectionOf(error)).toMatchObject(Option.some({ _tag: "BadRequest", field: "tags.1" }));
	});

	it("omits the field when the issue concerns the whole input", async () => {
		const error = await failureOf(client.range.query({ from: 2, to: 1 }));

		expect(rejectionOf(error)).toEqual(Option.some({ _tag: "BadRequest", message: "from must not be after to" }));
		expect(error).toMatchObject({ message: "from must not be after to", data: { code: "BAD_REQUEST", httpStatus: 400 } });
	});

	it("has the same wire shape as a BadRequest the procedure raises", async () => {
		const invalid = await failureOf(client.save.mutate({ ...valid, name: "" }));
		const raised = await failureOf(client.save.mutate({ ...valid, name: "taken" }));

		expect(Object.keys(Option.getOrThrow(rejectionOf(invalid))).sort()).toEqual(["_tag", "field", "message"]);
		expect(rejectionOf(raised)).toEqual(Option.some({ _tag: "BadRequest", message: "Name is taken", field: "name" }));
		expect(invalid).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400, rejection: { _tag: "BadRequest", field: "name" } } });
		expect(raised).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 } });
		expect(await client.save.mutate(valid)).toBe("Ada");
	});
});
