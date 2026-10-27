import { Context, Data, Effect } from "effect";
import { expect, expectTypeOf, it } from "vitest";
import { outcomes } from "#outcomes.ts";

class Sessions extends Context.Service<Sessions, number>()("@types/Sessions") {}
class Requests extends Context.Service<Requests, string>()("@types/Requests") {}
class Unavailable extends Data.TaggedError("Unavailable") {}
class Unauthorized extends Data.TaggedError("Unauthorized") {}

it("checks each expected value against its own readout", () => {
	outcomes({
		"alice's next request": [Effect.succeed("ok"), "ok"],
		"bob's sessions": [Effect.succeed(0), 0],
	});
	outcomes({
		"alice's next request": [Effect.succeed("ok"), "ok"],
		// @ts-expect-error A session count is a number, even beside a string readout.
		"bob's sessions": [Effect.succeed(0), "zero"],
	});
	outcomes({
		// @ts-expect-error A nested session count is also a number.
		"bob's account": [Effect.succeed({ sessions: 0 }), { sessions: "zero" }],
	});
});

it("accepts native Vitest asymmetric matchers", () => {
	outcomes({
		"alice's account": [Effect.succeed({ sessions: 1 }), { sessions: expect.any(Number) }],
		"bob's account": [Effect.succeed({ name: "Bob", sessions: 0 }), expect.objectContaining({ sessions: 0 })],
	});
});

it("preserves every readout's error and requirement types", () => {
	const result = outcomes({
		"alice's next request": [
			Requests.pipe(Effect.flatMap((status) => (status === "denied" ? Effect.fail(new Unauthorized()) : Effect.succeed(status)))),
			"ok",
		],
		"bob's sessions": [Sessions.pipe(Effect.flatMap((count) => (count < 0 ? Effect.fail(new Unavailable()) : Effect.succeed(count)))), 0],
	});
	expectTypeOf(result).toEqualTypeOf<Effect.Effect<void, Unavailable | Unauthorized, Sessions | Requests>>();
});
