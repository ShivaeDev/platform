import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Effect, Option, Schema } from "effect";
import { afterAll, expect, it } from "vitest";
import { command } from "@shivaedev/effect-contract/operation.ts";
import { fieldRejection } from "@shivaedev/effect-contract/rejection.ts";
import { decodeRejection, rejectionOf } from "#client/rejection.ts";
import { rejectWith } from "#rejection.ts";
import { failureOf, inProcess, procedure, runtime, t } from "#test/http.ts";

class OrderNotFound extends Schema.TaggedError<OrderNotFound>()("OrderNotFound", {}) {}

const Draft = Schema.Struct({ name: Schema.String, quantity: Schema.Number });

const Place = command("place", {
	invalidates: () => [],
	payload: Draft,
	rejections: { Invalid: fieldRejection(Draft), OrderNotFound },
	success: Schema.String,
});

const Forget = command("forget", { invalidates: () => [] });

const place = ({ name, quantity }: typeof Draft.Type): Effect.Effect<string, typeof Place.error.Type> => {
	if (name === "missing") {
		return Place.reject.OrderNotFound();
	}
	if (quantity < 0) {
		return Place.reject.Invalid({ field: "quantity", message: "Quantity cannot be negative" });
	}
	return Effect.succeed(`placed:${name}`);
};

const router = t.router({
	forget: procedure.mutation(function* () {
		return yield* Effect.fail(new OrderNotFound()).pipe(rejectWith(Forget.error));
	}),
	place: procedure.input(Place.payload).mutation(function* (draft) {
		return yield* place(draft).pipe(rejectWith(Place.error));
	}),
});

const client = createTRPCClient<typeof router>({ links: [httpBatchLink(inProcess(router))] });

afterAll(() => runtime.dispose());

it("sends a contract field rejection that decodes to the operation's generated class", async () => {
	const error = await failureOf(client.place.mutate({ name: "Desk lamps", quantity: -1 }));

	expect(error).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 } });
	expect(rejectionOf(error)).toEqual(Option.some({ _tag: "Invalid", field: "quantity", message: "Quantity cannot be negative" }));
	const rejection = Option.getOrThrow(decodeRejection(Place.error)(error));
	expect(rejection).toBeInstanceOf(Place.Rejection.Invalid);
	expect(rejection).toMatchObject({ field: "quantity", message: "Quantity cannot be negative" });
});

it("sends a reused rejection class by its tag", async () => {
	const error = await failureOf(client.place.mutate({ name: "missing", quantity: 1 }));

	expect(Option.getOrThrow(decodeRejection(Place.error)(error))).toBeInstanceOf(OrderNotFound);
	expect(await client.place.mutate({ name: "Desk lamps", quantity: 120 })).toBe("placed:Desk lamps");
});

it("keeps failures opaque for an operation without rejections", async () => {
	const error = await failureOf(client.forget.mutate());

	expect(error).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" } });
	expect(rejectionOf(error)).toEqual(Option.none());
	expect(decodeRejection(Forget.error)(error)).toEqual(Option.none());
});
