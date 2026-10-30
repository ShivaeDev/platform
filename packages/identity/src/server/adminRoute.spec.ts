import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { auth, signedInWithRole } from "#test/auth/story.ts";

const ADMIN_TOOLS = "Admin tools for member@example.test";

for (const [method, status] of [
	["GET", HttpStatus.fromLiteral("OK")],
	["POST", HttpStatus.fromLiteral("Created")],
] as const) {
	auth.it(
		`an admin's ${method} to the admin route runs its handler and receives its response`,
		[signedInWithRole("admin")],
		function* ({ adminHandlerRequests, openAdminTools }) {
			const response = yield* openAdminTools(method);

			yield* outcomes({
				"admin handler requests": [adminHandlerRequests(), [method]],
				response: [Effect.succeed(response), { body: ADMIN_TOOLS, status }],
			});
		},
	);
}

for (const [caller, traits, request, status] of [
	["a signed-in user without admin", [signedInWithRole("user")], { method: "GET", origin: undefined }, HttpStatus.fromLiteral("Forbidden")],
	["a signed-out caller", [], { method: "GET", origin: undefined }, HttpStatus.fromLiteral("Unauthorized")],
	[
		"an admin posting from a refused Origin",
		[signedInWithRole("admin")],
		{ method: "POST", origin: "https://refused.example" },
		HttpStatus.fromLiteral("Forbidden"),
	],
] as const) {
	auth.it(`${caller} is refused with ${status} before the admin route handler runs`, traits, function* ({ adminHandlerRequests, openAdminTools }) {
		yield* openAdminTools(request.method, request.origin);

		expect(yield* adminHandlerRequests()).toEqual([]);
	});
	auth.it(`${caller} receives ${status} from the admin route`, traits, function* ({ openAdminTools }) {
		expect(yield* openAdminTools(request.method, request.origin)).toMatchObject({ status });
	});
}

auth.it(
	"an unavailable session provider answers the admin route with 503 without running its handler",
	[signedInWithRole("admin")],
	function* ({ adminHandlerRequests, failSessionProvider, openAdminTools }) {
		yield* failSessionProvider();

		yield* outcomes({
			"admin route": [openAdminTools(), expect.objectContaining({ status: HttpStatus.fromLiteral("ServiceUnavailable") })],
			"handler requests": [adminHandlerRequests(), []],
		});
	},
);

auth.it(
	"after the admin role is removed, the same session's next admin route request is forbidden without running the handler",
	[signedInWithRole("admin")],
	function* ({ adminHandlerRequests, openAdminTools, setRole }) {
		expect(yield* openAdminTools()).toMatchObject({ status: HttpStatus.fromLiteral("OK") });

		yield* setRole("user");

		yield* outcomes({
			"admin route": [openAdminTools(), expect.objectContaining({ status: HttpStatus.fromLiteral("Forbidden") })],
			"handler requests": [adminHandlerRequests(), ["GET"]],
		});
	},
);

auth.it("an admin handler's own forbidden failure answers 422 with its message", [signedInWithRole("admin")], function* ({ openFailingAdminTools }) {
	expect(yield* openFailingAdminTools()).toEqual({ body: "Handler failure", status: HttpStatus.fromLiteral("UnprocessableEntity") });
});
