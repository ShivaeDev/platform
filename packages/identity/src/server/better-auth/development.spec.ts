import { expect } from "vitest";
import { authOptions, mount } from "#test/better-auth/mount.ts";

for (const origin of ["http://localhost:5173", "http://127.0.0.1:4173"]) {
	mount.it(`without a public URL, alice can sign up from ${origin} through a development proxy`, [], function* ({ signUp }) {
		expect(yield* signUp(origin)).toBe("accepted");
	});
}

mount.it(
	"when the app lists only 127.0.0.1 hosts, a sign-up through a localhost proxy is answered as unavailable",
	[authOptions("the app allows only 127.0.0.1 hosts", { "baseURL": { allowedHosts: ["127.0.0.1:*"], protocol: "http" } })],
	function* ({ signUp }) {
		expect(yield* signUp("http://localhost:5173")).toBe("unavailable");
	},
);

mount.it(
	"with a numeric base URL, the default trusted origins still accept a sign-up from localhost",
	[authOptions("the app's base URL is http://127.0.0.1:3000", { "baseURL": "http://127.0.0.1:3000" })],
	function* ({ signUp }) {
		expect(yield* signUp("http://localhost:5173", "127.0.0.1:3000")).toBe("accepted");
	},
);

mount.it(
	"when the app trusts only 127.0.0.1 origins, a sign-up from localhost is forbidden",
	[
		authOptions("the app's base URL is http://127.0.0.1:3000 and it trusts only 127.0.0.1 origins", {
			"baseURL": "http://127.0.0.1:3000",
			trustedOrigins: ["http://127.0.0.1:*"],
		}),
	],
	function* ({ signUp }) {
		expect(yield* signUp("http://localhost:5173", "127.0.0.1:3000")).toBe("forbidden");
	},
);

mount.it(
	"a production host without a proxy gives auth the visitor's own address and Better Auth logs no warning",
	[],
	function* ({ productionVisit }) {
		expect(yield* productionVisit()).toEqual({ answer: "accepted", client: "the connecting peer", warnings: [] });
	},
);
