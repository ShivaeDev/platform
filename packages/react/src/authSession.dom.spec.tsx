import { expect } from "vitest";
import { sessionLoading, sessionReady, sessions } from "#test/auth-session/story.tsx";

sessions.it("the initial session read makes the screen busy until it answers", [sessionLoading()], function* ({ answer, shown }) {
	expect(shown().busy).toBe("true");
	yield* answer();
	expect(shown()).toMatchObject({ busy: "false", text: expect.stringContaining("Alice") });
});

sessions.it(
	"a name change awaits the busy session refresh before completing",
	[sessionReady()],
	function* ({ press, answer, shown, completedFrames, waitForMutation }) {
		yield* press("Rename");
		expect(shown()).toMatchObject({ busy: "true", text: expect.stringContaining("AliceUnverifiedSaving") });
		expect(completedFrames()).toEqual([]);
		yield* answer();
		yield* waitForMutation();
		expect(shown()).toMatchObject({ busy: "false", text: expect.stringContaining("AliciaUnverifiedSaved") });
		expect(completedFrames().length).toBeGreaterThan(0);
		expect(completedFrames().every((frame) => frame.name === "Alicia" && !frame.busy)).toBe(true);
	},
);

sessions.it("email verification awaits the refreshed session", [sessionReady()], function* ({ press, answer, shown, waitForMutation }) {
	yield* press("Verify");
	expect(shown()).toMatchObject({ busy: "true", text: expect.stringContaining("UnverifiedSaving") });
	yield* answer();
	yield* waitForMutation();
	expect(shown()).toMatchObject({ busy: "false", text: expect.stringContaining("AliceVerifiedSaved") });
});

for (const failure of ["refuse", "reject"] as const) {
	sessions.it(`a ${failure} during refresh retains the session and fails the mutation`, [sessionReady()], function* (story) {
		yield* story.press("Rename");
		yield* story[failure]();
		yield* story.waitForMutation();
		expect(story.shown()).toMatchObject({ busy: "false", text: expect.stringContaining("AliceUnverifiedReadySession unavailable") });
		expect(story.completedFrames()).toEqual([]);
	});
}

sessions.it("a refresh can settle with a signed-out session", [sessionReady()], function* ({ signOut, press, answer, shown }) {
	yield* signOut();
	yield* press("Refresh");
	yield* answer();
	expect(shown()).toMatchObject({ busy: "false", text: expect.stringContaining("Signed out") });
});

sessions.it("malformed permissions make the session unavailable", [sessionLoading()], function* ({ malformPermissions, shown }) {
	yield* malformPermissions();

	expect(shown()).toMatchObject({ busy: "false", text: expect.stringContaining("Session unavailable") });
});

sessions.it(
	"the client session read exposes typed permission grants without an application decoder",
	[sessionLoading()],
	function* ({ answer, shown }) {
		yield* answer();

		expect(shown().grants).toBe("notes.read:any");
	},
);
