import { command, fieldRejection } from "@shivaedev/effect-contract";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Effect, Option, Schema } from "effect";
import { afterAll, expect, it } from "vitest";
import { decodeRejection, rejectionOf } from "../src/client.ts";
import { rejectWith } from "../src/index.ts";
import { failureOf, inProcess, procedure, runtime, t } from "./support/http.ts";

class MealNotFound extends Schema.TaggedError<MealNotFound>()("MealNotFound", {}) {}

const Draft = Schema.Struct({ name: Schema.String, calories: Schema.Number });

const Log = command("log", {
	payload: Draft,
	success: Schema.String,
	rejections: { MealNotFound, Invalid: fieldRejection(Draft) },
	invalidates: () => [],
});

const Forget = command("forget", { invalidates: () => [] });

const log = ({ name, calories }: typeof Draft.Type): Effect.Effect<string, typeof Log.error.Type> => {
	if (name === "missing") return Log.reject.MealNotFound();
	if (calories < 0) return Log.reject.Invalid({ field: "calories", message: "Calories cannot be negative" });
	return Effect.succeed(`logged:${name}`);
};

const router = t.router({
	log: procedure.input(Log.payload).mutation(function* (draft) {
		return yield* log(draft).pipe(rejectWith(Log.error));
	}),
	forget: procedure.mutation(function* () {
		return yield* Effect.fail(new MealNotFound()).pipe(rejectWith(Forget.error));
	}),
});

const client = createTRPCClient<typeof router>({ links: [httpBatchLink(inProcess(router))] });

afterAll(() => runtime.dispose());

it("sends a contract field rejection that decodes to the operation's generated class", async () => {
	const error = await failureOf(client.log.mutate({ name: "Soup", calories: -1 }));

	expect(error).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 } });
	expect(rejectionOf(error)).toEqual(Option.some({ _tag: "Invalid", field: "calories", message: "Calories cannot be negative" }));
	const rejection = Option.getOrThrow(decodeRejection(Log.error)(error));
	expect(rejection).toBeInstanceOf(Log.Rejection.Invalid);
	expect(rejection).toMatchObject({ field: "calories", message: "Calories cannot be negative" });
});

it("sends a reused rejection class by its tag", async () => {
	const error = await failureOf(client.log.mutate({ name: "missing", calories: 1 }));

	expect(Option.getOrThrow(decodeRejection(Log.error)(error))).toBeInstanceOf(MealNotFound);
	expect(await client.log.mutate({ name: "Soup", calories: 120 })).toBe("logged:Soup");
});

it("keeps failures opaque for an operation without rejections", async () => {
	const error = await failureOf(client.forget.mutate());

	expect(error).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" } });
	expect(rejectionOf(error)).toEqual(Option.none());
	expect(decodeRejection(Forget.error)(error)).toEqual(Option.none());
});
