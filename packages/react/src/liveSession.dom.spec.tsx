import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceSessionRevoked, liveSessionStory } from "#test/live-session/story.tsx";

liveSessionStory.it(
	"after alice loses read access, the next hint shows Read denied and keeps her subscription open",
	[],
	function* ({ denyRead, rename, shown, subscribers }) {
		expect(yield* subscribers()).toEqual(["alice"]);
		yield* denyRead();

		yield* rename("Private after denial");

		yield* outcomes([
			["shown", () => shown(), "Read denied"],
			["subscribers", () => subscribers(), ["alice"]],
		]);
	},
);

liveSessionStory.it(
	"restoring alice's read access shows the next changed note through her open subscription",
	[],
	function* ({ allowRead, denyRead, rename, shown, subscribers }) {
		yield* denyRead();
		yield* rename("Private after denial");
		expect(yield* shown()).toBe("Read denied");

		yield* allowRead();
		yield* rename("Visible after grant");

		yield* outcomes([
			["shown", () => shown(), "Visible after grant"],
			["subscribers", () => subscribers(), ["alice"]],
		]);
	},
);

liveSessionStory.it(
	"identity's Unauthorized after session revocation triggers a recheck and shows Sign in without reading the note again",
	[],
	function* ({ reads, recheckedSessions, revokeSession, shown }) {
		const before = yield* reads();
		yield* outcomes([
			["rechecked sessions", () => recheckedSessions(), []],
			["shown", () => shown(), "First"],
		]);

		yield* revokeSession();

		yield* outcomes([
			["reads", () => reads(), before],
			["rechecked sessions", () => recheckedSessions(), ["signed out"]],
			["shown", () => shown(), "Sign in"],
		]);
	},
);

liveSessionStory.it(
	"a revoked session leaves no live subscription on the server or in its registry",
	[],
	function* ({ registries, revokeSession, subscribers }) {
		expect(yield* registries()).toEqual(["holds atoms"]);

		yield* revokeSession();

		yield* outcomes([
			["registries", () => registries(), ["empty"]],
			["subscribers", () => subscribers(), []],
		]);
	},
);

liveSessionStory.it(
	"after alice signs in again, a change hint refreshes her note in a new registry",
	[aliceSessionRevoked()],
	function* ({ registries, rename, shown, signIn }) {
		yield* signIn();

		yield* rename("After sign-in");

		yield* outcomes([
			["registries", () => registries(), ["empty", "holds atoms"]],
			["shown", () => shown(), "After sign-in"],
		]);
	},
);
