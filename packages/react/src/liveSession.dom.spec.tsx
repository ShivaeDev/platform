import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceSessionRevoked, liveSessionStory } from "#test/live-session/story.tsx";

liveSessionStory.it(
	"after alice loses read access, the next change hint shows Read denied and ends her subscription",
	[],
	function* ({ denyRead, rename, shown, subscribers }) {
		expect(yield* subscribers()).toEqual(["alice"]);
		yield* denyRead();

		yield* rename("Private after denial");

		yield* outcomes({
			shown: [shown(), "Read denied"],
			subscribers: [subscribers(), []],
		});
	},
);

liveSessionStory.it(
	"when the server revokes alice's session, stream revalidation rechecks it and shows Sign in without reading the note again",
	[],
	function* ({ reads, rechecks, revokeSession, shown }) {
		const before = yield* reads();

		yield* revokeSession();

		yield* outcomes({
			reads: [reads(), before],
			rechecks: [rechecks(), ["signed out"]],
			shown: [shown(), "Sign in"],
		});
	},
);

liveSessionStory.it(
	"a revoked session leaves no live subscription on the server or in its registry",
	[],
	function* ({ registries, revokeSession, subscribers }) {
		expect(yield* registries()).toEqual(["holds atoms"]);

		yield* revokeSession();

		yield* outcomes({
			registries: [registries(), ["empty"]],
			subscribers: [subscribers(), []],
		});
	},
);

liveSessionStory.it(
	"after alice signs in again, a change hint refreshes her note in a new registry",
	[aliceSessionRevoked()],
	function* ({ registries, rename, shown, signIn }) {
		yield* signIn();

		yield* rename("After sign-in");

		yield* outcomes({
			registries: [registries(), ["empty", "holds atoms"]],
			shown: [shown(), "After sign-in"],
		});
	},
);
