import { expect } from "vitest";
import { signInWindow } from "#test/better-auth/signInWindow.ts";

signInWindow.it(
	"alice's sign-in retry time rounds up to whole seconds and expires from her first admitted request",
	[],
	function* ({ request, timePasses }) {
		expect((yield* request()).allowed).toBe(true);
		yield* timePasses(9000);
		expect((yield* request()).allowed).toBe(true);
		yield* timePasses(500);

		expect(yield* request()).toEqual({ allowed: false, retryAfter: 1 });

		yield* timePasses(500);

		expect(yield* request()).toEqual({ allowed: true, retryAfter: null });
	},
);
