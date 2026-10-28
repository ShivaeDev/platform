import { DateTime, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { GitHubRateLimited } from "#errors.ts";
import { budgetHeaders } from "#test/budgetHeaders.ts";
import { FIXTURE_TOKEN } from "#test/fixtures.ts";
import { github } from "#test/github.ts";
import { coreNearlySpent, routeAnswers, searchLimitedUntil } from "#test/traits.ts";

github.it(
	"a primary search limit blocks further requests until its reset without blocking core",
	[searchLimitedUntil(120)],
	function* ({ search, readPull, observations, requests }) {
		const error = yield* Effect.flip(search());
		expect(error).toEqual(new GitHubRateLimited({ resource: "search", retryAt: DateTime.makeUnsafe(120_000) }));
		expect(yield* Effect.flip(search())).toEqual(error);
		expect(requests().map(({ path }) => path)).toEqual(["/search/issues?private=query-secret"]);
		expect((yield* observations())[0]?.reset).toEqual(DateTime.makeUnsafe(120_000));
		yield* Effect.flip(readPull());
		expect(requests().map(({ path }) => path)).toEqual(["/search/issues?private=query-secret", "/repos/acme/widgets/pulls/1?private=query-secret"]);
		yield* TestClock.adjust("120 seconds");
		yield* Effect.flip(search());
		expect(requests().map(({ path }) => path)).toEqual([
			"/search/issues?private=query-secret",
			"/repos/acme/widgets/pulls/1?private=query-secret",
			"/search/issues?private=query-secret",
		]);
	},
);

for (const status of [HttpStatus.fromLiteral("Forbidden"), HttpStatus.fromLiteral("TooManyRequests")]) {
	github.it(
		`a secondary ${status} limit prefers Retry-After and uses TestClock`,
		[
			routeAnswers({
				body: { message: "Please wait" },
				headers: { ...budgetHeaders("core", 40, 900), "Retry-After": "30" },
				status,
			}),
		],
		function* ({ readPull, requests }) {
			yield* TestClock.adjust("10 seconds");
			const error = yield* Effect.flip(readPull());
			expect(error).toEqual(new GitHubRateLimited({ resource: "core", retryAt: DateTime.makeUnsafe(40_000) }));
			expect(yield* Effect.flip(readPull())).toEqual(error);
			expect(requests().map(({ path }) => path)).toEqual(["/repos/acme/widgets/pulls/1?private=query-secret"]);
			yield* TestClock.adjust("29 seconds");
			yield* Effect.flip(readPull());
			expect(requests().map(({ path }) => path)).toEqual(["/repos/acme/widgets/pulls/1?private=query-secret"]);
			yield* TestClock.adjust("1 second");
			yield* Effect.flip(readPull());
			expect(requests().map(({ path }) => path)).toEqual([
				"/repos/acme/widgets/pulls/1?private=query-secret",
				"/repos/acme/widgets/pulls/1?private=query-secret",
			]);
		},
	);
}

github.it(
	"waits one minute for a secondary limit named in the 403 message",
	[
		routeAnswers({
			body: { message: "You have exceeded a secondary rate limit" },
			headers: budgetHeaders("core", 40, 120),
			status: HttpStatus.fromLiteral("Forbidden"),
		}),
	],
	function* ({ readPull }) {
		expect(yield* Effect.flip(readPull())).toEqual(new GitHubRateLimited({ resource: "core", retryAt: DateTime.makeUnsafe(60_000) }));
	},
);

github.it(
	"parses an HTTP date Retry-After as UTC",
	[
		routeAnswers({
			headers: { ...budgetHeaders("search", 0, 900), "Retry-After": "Thu, 01 Jan 1970 00:02:00 GMT" },
			status: HttpStatus.fromLiteral("TooManyRequests"),
		}),
	],
	function* ({ search }) {
		expect(yield* Effect.flip(search())).toEqual(new GitHubRateLimited({ resource: "search", retryAt: DateTime.makeUnsafe(120_000) }));
	},
);

github.it(
	"observes budgets per resource, including conditional responses",
	[coreNearlySpent],
	function* ({ readPull, search, observations, setBudget }) {
		yield* readPull();
		yield* setBudget("core", 1, 200);
		yield* readPull();
		yield* setBudget("search", 7, 300);
		yield* search();
		expect(yield* observations()).toEqual([
			{ limit: 5000, remaining: 1, reset: DateTime.makeUnsafe(200_000), resource: "core", used: 4999 },
			{ limit: 5000, remaining: 7, reset: DateTime.makeUnsafe(300_000), resource: "search", used: 4993 },
		]);
	},
);

github.it(
	"each failure emits one safe log and one span event, including locally blocked reads",
	[searchLimitedUntil(120)],
	function* ({ search, telemetry }) {
		const errors = [yield* Effect.flip(search()), yield* Effect.flip(search())];
		const { logs, spans } = telemetry();
		const fields = { path: "/search/issues", remaining: 0, resource: "search", retryAt: "1970-01-01T00:02:00.000Z" };
		expect(logs).toEqual(errors.map(() => ({ annotations: {}, message: ["GitHub rate limited", fields] })));
		const events = spans.flatMap((span) => span.events).filter(([name]) => name === "GitHub.rateLimited");
		expect(events).toHaveLength(errors.length);
		for (const event of events) {
			expect(event[2]).toEqual({ path: "/search/issues", remaining: 0, resource: "search", retryAt: "1970-01-01T00:02:00.000Z" });
		}
		const recorded = JSON.stringify({
			errors,
			logs,
			spans: spans.map(({ attributes, events: spanEvents, status }) => ({
				attributes: [...attributes],
				events: spanEvents.map(([name, , eventAttributes]) => ({ attributes: eventAttributes, name })),
				exit: status._tag === "Ended" ? status.exit : undefined,
			})),
		});
		expect(recorded).not.toContain(FIXTURE_TOKEN);
		expect(JSON.stringify({ events: events.map(([name, , attributes]) => ({ attributes, name })), logs })).not.toContain("query-secret");
	},
);

github.it(
	"a primary 429 uses the reset even without Retry-After",
	[
		routeAnswers({
			body: { message: "Budget exhausted" },
			headers: budgetHeaders("core", 0, 120),
			status: HttpStatus.fromLiteral("TooManyRequests"),
		}),
	],
	function* ({ readPull }) {
		expect(yield* Effect.flip(readPull())).toEqual(new GitHubRateLimited({ resource: "core", retryAt: DateTime.makeUnsafe(120_000) }));
	},
);
