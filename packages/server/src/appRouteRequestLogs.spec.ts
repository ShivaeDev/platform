import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { loggedApplicationRoutes } from "#test/app-host/loggedApplicationRoutes.ts";
import { host } from "#test/app-host/story.ts";

for (const [route, status] of [
	["/items/:id", "Created"],
	["/refused/:id", "Forbidden"],
	["/failed/:id", "InternalServerError"],
] as const) {
	host.it(
		`an application route returning ${status} logs one structured request without credentials, URL values or bodies`,
		[loggedApplicationRoutes],
		function* ({ diagnosticLogs, logMentions, request }) {
			const response = yield* request(`${route.replace(":id", "private-path-value")}?secret=private-query-value`, {
				body: "private-request-body",
				headers: { authorization: "Bearer private-authorization-value", cookie: "session=private-cookie-value" },
				method: "POST",
			});

			expect(response.status).toBe(HttpStatus.fromLiteral(status));
			yield* outcomes([
				[
					"recorded request log",
					() => diagnosticLogs("HTTP request"),
					[
						{
							"http.duration": expect.any(Number),
							"http.method": "POST",
							"http.route": route,
							"http.status": HttpStatus.fromLiteral(status),
							requestId: expect.stringMatching(/^[a-f0-9-]{36}$/u),
						},
					],
				],
				[
					"leaked request or response data",
					() =>
						logMentions(
							"private-authorization-value",
							"private-cookie-value",
							"private-path-value",
							"private-query-value",
							"private-request-body",
							"private-response-body",
						),
					[],
				],
			]);
		},
	);
}

host.it("an application route logs its CORS preflight once", [loggedApplicationRoutes], function* ({ diagnosticLogs, preflight }) {
	yield* preflight("/items/private-path-value", "POST");

	expect(yield* diagnosticLogs("HTTP request")).toEqual([
		{
			"http.duration": expect.any(Number),
			"http.method": "OPTIONS",
			"http.route": "/items/:id",
			"http.status": HttpStatus.fromLiteral("NoContent"),
			requestId: expect.stringMatching(/^[a-f0-9-]{36}$/u),
		},
	]);
});

host.it(
	"an application request log measures the route's duration in milliseconds",
	[loggedApplicationRoutes],
	function* ({ diagnosticLogs, requestSlowRoute }) {
		yield* requestSlowRoute();

		expect(yield* diagnosticLogs("HTTP request")).toEqual([
			{
				"http.duration": 25,
				"http.method": "GET",
				"http.route": "/slow",
				"http.status": HttpStatus.fromLiteral("NoContent"),
				requestId: expect.stringMatching(/^[a-f0-9-]{36}$/u),
			},
		]);
	},
);
