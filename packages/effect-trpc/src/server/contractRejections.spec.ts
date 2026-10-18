import { Option } from "effect";
import { expect } from "vitest";
import { orderContracts } from "#test/orderContracts.ts";
import { Forget, OrderNotFound, Place } from "#test/orderSchemas.ts";
import { trpc } from "#test/routerStory.ts";

trpc.it(
	"sends a contract field rejection that decodes to the operation's generated class",
	[orderContracts()],
	function* ({ rejection: readRejection, decode, rejectMutation }) {
		const error = yield* rejectMutation("place", { name: "Desk lamps", quantity: -1 });
		expect(error).toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 } });
		expect(readRejection(error)).toEqual(Option.some({ _tag: "Invalid", field: "quantity", message: "Quantity cannot be negative" }));
		const rejection = Option.getOrThrow(decode(Place.error, error));
		expect(rejection).toBeInstanceOf(Place.Rejection.Invalid);
		expect(rejection).toMatchObject({ field: "quantity", message: "Quantity cannot be negative" });
	},
);
trpc.it("sends a reused rejection class by its tag", [orderContracts()], function* ({ decode, rejectMutation, mutate }) {
	const error = yield* rejectMutation("place", { name: "missing", quantity: 1 });
	expect(Option.getOrThrow(decode(Place.error, error))).toBeInstanceOf(OrderNotFound);
	expect(yield* mutate("place", { name: "Desk lamps", quantity: 120 })).toBe("placed:Desk lamps");
});
trpc.it("keeps failures opaque for an operation without rejections", [orderContracts()], function* ({ rejection, decode, rejectMutation }) {
	const error = yield* rejectMutation("forget");
	expect(error).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" } });
	expect(rejection(error)).toEqual(Option.none());
	expect(decode(Forget.error, error)).toEqual(Option.none());
});
