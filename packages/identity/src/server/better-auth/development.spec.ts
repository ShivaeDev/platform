import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { authOptions, mount } from "#test/better-auth/mount.ts";

for (const origin of ["http://localhost:5173", "http://127.0.0.1:4173"]) {
	mount.it(`signs in from ${origin} through a development proxy`, [], function* ({ signUp, signIn }) {
		expect((yield* signUp(origin)).status).toBe(HttpStatus.fromLiteral("OK"));
		const response = yield* signIn(origin);
		expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(response.body).toMatchObject({ token: expect.any(String), user: { email: "alice@example.test" } });
	});
}

mount.it(
	"explicit baseURL.allowedHosts replaces the loopback defaults",
	[authOptions({ "baseURL": { allowedHosts: ["127.0.0.1:*"], protocol: "http" } })],
	function* ({ signUp }) {
		expect((yield* signUp("http://localhost:5173")).status).toBe(HttpStatus.fromLiteral("ServiceUnavailable"));
	},
);

mount.it(
	"the default trusted origins allow localhost with an explicit numeric base URL",
	[authOptions({ "baseURL": "http://127.0.0.1:3000" })],
	function* ({ signUp }) {
		expect((yield* signUp("http://localhost:5173", "127.0.0.1:3000")).status).toBe(HttpStatus.fromLiteral("OK"));
	},
);

mount.it(
	"explicit trustedOrigins replaces the loopback defaults",
	[authOptions({ "baseURL": "http://127.0.0.1:3000", trustedOrigins: ["http://127.0.0.1:*"] })],
	function* ({ signUp }) {
		expect((yield* signUp("http://localhost:5173", "127.0.0.1:3000")).status).toBe(HttpStatus.fromLiteral("Forbidden"));
	},
);

mount.it("resolves the peer IP without Better Auth's missing-IP warning in production", [], function* ({ productionRequest }) {
	const response = yield* productionRequest();
	expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(response.logs).not.toEqual(
		expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("could not determine a client IP") })]),
	);
});
