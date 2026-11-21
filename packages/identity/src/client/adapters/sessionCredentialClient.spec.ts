import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nativeSessions, nativeTransport, passwordAccount } from "#test/native-sessions/story.ts";

const shell = [nativeTransport, passwordAccount("alice")];
const UNAUTHORIZED = "failed with unauthorized";

nativeSessions.it(
	"the shell's sign-in stores Alice's credential, and its session check sends it as a bearer with credentials omitted",
	shell,
	function* ({ shellChecksSession, shellCredentialsModes, shellSignsIn }) {
		yield* shellSignsIn("alice");

		yield* outcomes([
			["session", () => shellChecksSession(), "alice"],
			["credentials modes", () => shellCredentialsModes(), ["omit"]],
		]);
	},
);

nativeSessions.it(
	"signing out through the shell clears its stored credential",
	shell,
	function* ({ shellSignsIn, shellSignsOut, storedCredentialSession }) {
		yield* shellSignsIn("alice");
		expect(yield* storedCredentialSession()).toBe("alice");

		yield* shellSignsOut();

		expect(yield* storedCredentialSession()).toBe("no credential");
	},
);

nativeSessions.it(
	"a session check sent with Alice's expired credential answers signed out and clears it",
	shell,
	function* ({ sessionExpires, shellChecksSession, shellSignsIn, storedCredentialSession }) {
		yield* shellSignsIn("alice");
		yield* sessionExpires();

		expect(yield* shellChecksSession()).toBe("no session");

		expect(yield* storedCredentialSession()).toBe("no credential");
	},
);

nativeSessions.it(
	"a session check sent before Alice signs in answers signed out after it and leaves her new credential in place",
	shell,
	function* ({ heldCheckAnswers, shellSendsHeldSessionCheck, shellSignsIn, storedCredentialSession }) {
		yield* shellSendsHeldSessionCheck();
		yield* shellSignsIn("alice");

		yield* outcomes([
			["held check", () => heldCheckAnswers(), "no session"],
			["stored credential", () => storedCredentialSession(), "alice"],
		]);
	},
);

nativeSessions.it(
	"the socket's first frame follows sign-in, sign-out and a second sign-in without the shell passing a token",
	shell,
	function* ({ shellReadsProfileOverSocket, shellSignsIn, shellSignsOut }) {
		yield* shellSignsIn("alice");
		expect(yield* shellReadsProfileOverSocket("alice")).toBe("alice's profile");

		yield* shellSignsOut();
		expect(yield* shellReadsProfileOverSocket("alice")).toBe(UNAUTHORIZED);

		yield* shellSignsIn("alice");
		expect(yield* shellReadsProfileOverSocket("alice")).toBe("alice's profile");
	},
);
