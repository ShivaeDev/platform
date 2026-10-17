import { Effect } from "effect";
import { afterAll, afterEach, expect } from "vitest";
import { storyKit } from "#storyKit.ts";
import { outboundServers, responseFrom } from "#test/outbound.ts";

const servers = outboundServers();
const failedBodies: string[] = [];
const kit = storyKit({
	after: {
		*built() {
			expect(yield* responseFrom(servers.original())).toMatchObject({ name: "fake" });
		},
	},
	around: (effect) =>
		Effect.gen(function* () {
			expect(yield* responseFrom(servers.original())).toMatchObject({ name: "fake" });
			return yield* effect;
		}),
	clock: "live",
	*create() {
		expect(yield* responseFrom(servers.original())).toMatchObject({ name: "fake" });
		yield* Effect.addFinalizer(() =>
			responseFrom(servers.original()).pipe(Effect.tap((response) => Effect.sync(() => expect(response).toMatchObject({ name: "fake" })))),
		);
		return {};
	},
	name: "outbound",
	outbound: servers.outbound,
	stages: ["built"],
	verbs: () => ({}),
});
const routedTrait = kit.trait("built", "a third party is available", function* () {
	expect(yield* responseFrom(servers.original())).toMatchObject({ name: "fake" });
});

afterEach(async () => {
	const response = await fetch(servers.original());
	expect(await response.json()).toMatchObject({ name: "real", path: "/original" });
});

kit.it("routes selected hostnames through native fetch and keeps the request", [routedTrait], function* () {
	expect(
		yield* responseFrom("https://github.com/login/oauth/access_token?client_id=story", {
			body: "code=story-code",
			headers: { "x-story": "token" },
			method: "POST",
		}),
	).toEqual({ body: "code=story-code", header: "token", method: "POST", name: "fake", path: "/login/oauth/access_token?client_id=story" });
	expect(yield* responseFrom("https://api.github.com/user")).toMatchObject({ name: "fake", path: "/user" });
	expect(yield* responseFrom(servers.other())).toMatchObject({ name: "real", path: "/other" });
});

kit.it.fails("restores routing after a failed story", [], function* () {
	expect(yield* responseFrom(servers.original())).toMatchObject({ name: "fake" });
	failedBodies.push("reached fake");
	yield* Effect.fail("intentional story failure");
});

kit.it("installs routing again for the next story", [], function* () {
	expect(yield* responseFrom(servers.original())).toMatchObject({ name: "fake" });
});

afterAll(() => {
	expect(failedBodies.length).toBeGreaterThan(0);
});
