import { Context, Data, Effect } from "effect";
import { expect, expectTypeOf, it } from "vitest";
import { atMost } from "#adapters/outcomeMatchers.ts";
import { outcomes } from "#outcomes.ts";

class Sessions extends Context.Service<Sessions, number>()("@types/Sessions") {}
class Requests extends Context.Service<Requests, string>()("@types/Requests") {}
class Unavailable extends Data.TaggedError("Unavailable") {}
class Unauthorized extends Data.TaggedError("Unauthorized") {}

it("checks each expected value against its own readout", () => {
	outcomes([
		["alice's next request", () => Effect.succeed("ok"), "ok"],
		["bob's sessions", () => Effect.succeed(0), 0],
	]);
	outcomes([
		["alice's next request", () => Effect.succeed("ok"), "ok"],
		// @ts-expect-error A session count is a number, even beside a string readout.
		["bob's sessions", () => Effect.succeed(0), "zero"],
	]);
	outcomes([
		// @ts-expect-error A nested session count is also a number.
		["bob's account", () => Effect.succeed({ sessions: 0 }), { sessions: "zero" }],
	]);
});

it("accepts native Vitest asymmetric matchers", () => {
	outcomes([
		["alice's account", () => Effect.succeed({ sessions: 1 }), { sessions: expect.any(Number) }],
		["bob's account", () => Effect.succeed({ name: "Bob", sessions: 0 }), expect.objectContaining({ sessions: 0 })],
	]);
});

it("accepts nested partial values and numeric bounds while rejecting wrong nested types", () => {
	outcomes([
		["account", () => Effect.succeed({ account: { name: "Bob", sessions: 1 }, status: "ready" }), { account: { sessions: atMost(1) } }],
		["sessions", () => Effect.succeed(1), atMost(1)],
	]);
	outcomes([
		// @ts-expect-error Nested partial session counts still require numbers.
		["account", () => Effect.succeed({ account: { name: "Bob", sessions: 1 } }), { account: { sessions: "one" } }],
	]);
	outcomes([
		// @ts-expect-error Numeric bounds cannot match a string readout.
		["name", () => Effect.succeed("Bob"), atMost(1)],
	]);
});

it("preserves every readout's error and requirement types", () => {
	const result = outcomes([
		[
			"alice's next request",
			() => Requests.pipe(Effect.flatMap((status) => (status === "denied" ? Effect.fail(new Unauthorized()) : Effect.succeed(status)))),
			"ok",
		],
		["bob's sessions", () => Sessions.pipe(Effect.flatMap((count) => (count < 0 ? Effect.fail(new Unavailable()) : Effect.succeed(count)))), 0],
	]);
	expectTypeOf(result).toEqualTypeOf<Effect.Effect<void, Unavailable | Unauthorized, Sessions | Requests>>();
});
