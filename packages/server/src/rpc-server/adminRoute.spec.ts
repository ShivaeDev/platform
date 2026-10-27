import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { auth, signedInWithRole } from "#test/auth/story.ts";

auth.it("an admin receives the handler response on GET and POST", [signedInWithRole("admin")], function* ({ openAdminTools, adminHandlerRequests }) {
	expect(yield* openAdminTools()).toEqual({ body: "Admin tools for member@example.test", status: HttpStatus.fromLiteral("OK") });
	expect(yield* openAdminTools("POST")).toEqual({ body: "Admin tools for member@example.test", status: HttpStatus.fromLiteral("Created") });
	expect(yield* adminHandlerRequests()).toEqual(["GET", "POST"]);
});

auth.it("a signed-in user without admin cannot run the handler", [signedInWithRole("user")], function* ({ openAdminTools, adminHandlerRequests }) {
	expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("Forbidden"));
	expect(yield* adminHandlerRequests()).toEqual([]);
});

auth.it("a signed-out caller cannot run the handler", [], function* ({ openAdminTools, adminHandlerRequests }) {
	expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("Unauthorized"));
	expect(yield* adminHandlerRequests()).toEqual([]);
});

auth.it("a refused Origin cannot run the handler", [signedInWithRole("admin")], function* ({ openAdminTools, adminHandlerRequests }) {
	expect((yield* openAdminTools("POST", "https://refused.example")).status).toBe(HttpStatus.fromLiteral("Forbidden"));
	expect(yield* adminHandlerRequests()).toEqual([]);
});

auth.it(
	"an unavailable session provider returns 503 without running the handler",
	[signedInWithRole("admin")],
	function* ({ failSessionProvider, openAdminTools, adminHandlerRequests }) {
		yield* failSessionProvider();
		expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("ServiceUnavailable"));
		expect(yield* adminHandlerRequests()).toEqual([]);
	},
);

auth.it(
	"removing admin prevents the next request with the same session from running the handler",
	[signedInWithRole("admin")],
	function* ({ openAdminTools, setRole, adminHandlerRequests }) {
		expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("OK"));
		yield* setRole("user");
		expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("Forbidden"));
		expect(yield* adminHandlerRequests()).toEqual(["GET"]);
	},
);

auth.it("a handler's own Forbidden failure stays in the typed error channel", [signedInWithRole("admin")], function* ({ openFailingAdminTools }) {
	expect(yield* openFailingAdminTools()).toEqual({ body: "Handler failure", status: HttpStatus.fromLiteral("UnprocessableEntity") });
});
