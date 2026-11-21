import type { BetterAuthOptions } from "better-auth";
import { expect } from "vitest";
import { authOptions, mount, nativeOrigins } from "#test/better-auth/mount.ts";

const SHELL = "capacitor://localhost";
const HOST = "127.0.0.1:3000";

mount.it("without declared native origins, a sign-up from the bundled origin is forbidden", [], function* ({ signUp }) {
	expect(yield* signUp(SHELL, HOST)).toBe("forbidden");
});

mount.it("a declared native origin is trusted by Better Auth for sign-up", [nativeOrigins([SHELL])], function* ({ signUp }) {
	expect(yield* signUp(SHELL, HOST)).toBe("accepted");
});

mount.it("an origin the declaration does not name stays forbidden for sign-up", [nativeOrigins([SHELL])], function* ({ signUp }) {
	expect(yield* signUp("capacitor://other", HOST)).toBe("forbidden");
});

const appOrigins: ReadonlyArray<readonly [string, BetterAuthOptions["trustedOrigins"]]> = [
	["a list", ["http://127.0.0.1:*"]],
	["a function", () => ["http://127.0.0.1:*"]],
];
for (const [form, trustedOrigins] of appOrigins) {
	mount.it(
		`a declared native origin joins the app's own trusted origins given as ${form}`,
		[authOptions(`the app trusts 127.0.0.1 origins through ${form}`, { trustedOrigins }), nativeOrigins([SHELL])],
		function* ({ signUp }) {
			expect(yield* signUp(SHELL, HOST)).toBe("accepted");
		},
	);
}

for (const origin of ["*", "https://*.example", "capacitor://localhost/path", "https://localhost/path", "https://localhost?query", "null"]) {
	mount.it(`an auth declaration naming ${origin} as a native origin fails startup with a config error`, [], function* ({ startDeclaring }) {
		expect(yield* startDeclaring([origin])).toBe("failed with config error");
	});
}
