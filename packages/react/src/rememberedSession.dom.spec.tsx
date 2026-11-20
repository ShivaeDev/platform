import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceRemembered, rememberedFor, rememberedSessions } from "#test/remembered-session/story.tsx";

rememberedSessions.it(
	"a returning person's shell renders from the remembered session while the check is on the wire",
	[aliceRemembered()],
	function* ({ launches, refreshing, shown }) {
		yield* launches();

		yield* outcomes([
			["screen", () => shown(), "alice in generation 1Grants: notes.read, notes.writeSign out"],
			["refreshing", () => refreshing(), "true"],
		]);
	},
);

rememberedSessions.it(
	"the same user's answer keeps the generation and refreshes its grants",
	[aliceRemembered()],
	function* ({ answers, heldAtoms, launches, refreshing, shown }) {
		yield* launches();

		yield* answers("alice", ["notes.read"]);

		yield* outcomes([
			["screen", () => shown(), "alice in generation 1Grants: notes.readSign out"],
			["refreshing", () => refreshing(), "false"],
		]);
		expect(yield* heldAtoms("alice")).toBeGreaterThan(0);
	},
);

rememberedSessions.it(
	"another user's answer starts a new generation and empties the remembered user's registry",
	[aliceRemembered()],
	function* ({ answers, heldAtoms, launches, remembered, shown }) {
		yield* launches();
		expect(yield* heldAtoms("alice")).toBeGreaterThan(0);

		yield* answers("bob", ["notes.read"]);

		yield* outcomes([
			["screen", () => shown(), "bob in generation 2Grants: notes.readSign out"],
			["alice's atoms", () => heldAtoms("alice"), 0],
		]);
		expect(JSON.parse((yield* remembered()) ?? "null")).toMatchObject({ user: { id: "bob" } });
	},
);

rememberedSessions.it(
	"a signed-out answer wipes the memory before the signed-out screen renders",
	[aliceRemembered()],
	function* ({ heldAtoms, launches, remembered, shown, signedOutAnswer }) {
		yield* launches();

		yield* signedOutAnswer();

		yield* outcomes([
			["screen", () => shown(), "Signed out with nothing remembered"],
			["memory", () => remembered(), null],
			["alice's atoms", () => heldAtoms("alice"), 0],
		]);
	},
);

rememberedSessions.it(
	"an explicit sign-out wipes the memory even when the session check after it never answers",
	[aliceRemembered()],
	function* ({ answers, launches, relaunches, remembered, shown, signsOut }) {
		yield* launches();
		yield* answers("alice", ["notes.read"]);

		yield* signsOut();
		expect(yield* remembered()).toBeNull();

		yield* relaunches();

		expect(yield* shown()).toBe("Checking your session…");
	},
);

rememberedSessions.it(
	"a session check that fails without a network keeps the remembered session rendering",
	[aliceRemembered()],
	function* ({ checkFails, launches, shown }) {
		yield* launches();

		yield* checkFails();

		expect(yield* shown()).toBe("alice in generation 1Grants: notes.read, notes.writeSign out");
	},
);

rememberedSessions.it(
	"past the remembered expiry the launch waits for the check and the memory is wiped",
	[aliceRemembered()],
	function* ({ answers, launches, remembered, shown, timePasses }) {
		yield* timePasses(rememberedFor);

		yield* launches();

		yield* outcomes([
			["screen", () => shown(), "Checking your session…"],
			["memory", () => remembered(), null],
		]);

		yield* answers("alice", ["notes.read"]);

		expect(yield* shown()).toBe("alice in generation 1Grants: notes.readSign out");
	},
);

rememberedSessions.it(
	"the memory keeps the user id, session id, grants and expiry and never the session token",
	[aliceRemembered()],
	function* ({ answers, launches, remembered }) {
		yield* launches();

		yield* answers("alice", ["notes.read"]);

		const stored = yield* remembered();
		expect(stored).not.toContain("secret-token");
		expect(JSON.parse(stored ?? "null")).toEqual({
			session: { expiresAt: new Date(2 * rememberedFor).toISOString(), id: "alice-session" },
			user: { id: "alice", permissions: [{ name: "notes.read", strength: "any" }] },
		});
	},
);
