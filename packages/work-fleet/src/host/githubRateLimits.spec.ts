import { expect } from "@effect/vitest";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { failureContext } from "#engine/failureContext.ts";
import { githubRateLimited } from "#host/githubRateLimit.ts";
import { githubHost } from "#test/githubHostStory.ts";

const PR = "repos/example/project/pulls/7";
const FILES = `${PR}/files?per_page=100`;
const OPEN = { number: 7, state: "open" };
const CLOSED = { number: 7, state: "closed" };
const PAGES = [[{ filename: "one.ts" }], [{ filename: "two.ts" }]];
const SECONDARY = { message: "You have exceeded a secondary rate limit" };
const EXHAUSTED_RESET = 120;
const RESERVE_RESET = 600;
const RESERVE_EDGE = 1001;

githubHost.it("records each response's rate-limit headers by resource with the time Fleet observed them", [], function* (story) {
	const github = yield* story.api({ remaining: 4200, reset: 3600 });
	github.reply(PR, { number: 7 });
	expect(yield* github.client.observations()).toEqual([]);
	yield* story.elapse("5 seconds");

	yield* github.client.get(PR);

	expect(yield* github.client.observations()).toEqual([
		{ limit: 5000, limitedBy: null, limitedUntil: null, observedAt: 5000, remaining: 4199, reset: 3600, resource: "core", used: 801 },
	]);
});

githubHost.it("an unchanged resource is answered by a conditional request that spends no budget and keeps the cached body", [], function* (story) {
	const github = yield* story.api();
	github.reply(PR, OPEN);
	expect(yield* github.read(PR)).toEqual(OPEN);
	const remaining = github.budget.remaining;

	const again = yield* github.read(PR);

	expect({ body: again, remaining: github.budget.remaining, statuses: github.statuses() }).toEqual({
		body: OPEN,
		remaining,
		statuses: [`200 ${PR}`, `304 ${PR}`],
	});
});

githubHost.it("a changed resource replaces the cached body and spends one request", [], function* (story) {
	const github = yield* story.api();
	github.reply(PR, OPEN);
	expect(yield* github.read(PR)).toEqual(OPEN);
	const remaining = github.budget.remaining;
	github.reply(PR, CLOSED);

	const changed = yield* github.read(PR);

	expect({ body: changed, spent: remaining - github.budget.remaining }).toEqual({ body: CLOSED, spent: 1 });
});

githubHost.it("pages follow Link headers and every page is conditional", [], function* (story) {
	const github = yield* story.api();
	const next = "https://api.github.com/repositories/1/pulls/7/files?per_page=100&page=2";
	github.reply(FILES, [{ filename: "one.ts" }], { headers: { Link: `<${next}>; rel="next"` } });
	github.reply(next, [{ filename: "two.ts" }]);
	expect(yield* github.pagesOf(FILES)).toEqual(PAGES);

	const again = yield* github.pagesOf(FILES);

	expect({ pages: again, statuses: github.requests.map(({ status }) => status) }).toEqual({
		pages: PAGES,
		statuses: [
			HttpStatus.fromLiteral("OK"),
			HttpStatus.fromLiteral("OK"),
			HttpStatus.fromLiteral("NotModified"),
			HttpStatus.fromLiteral("NotModified"),
		],
	});
});

githubHost.it("an exhausted budget refuses the call until its reset and records the limit", [], function* (story) {
	const github = yield* story.api({ remaining: 0, reset: EXHAUSTED_RESET });
	github.reply(PR, { message: "API rate limit exceeded" }, { status: HttpStatus.fromLiteral("Forbidden") });

	const limited = yield* github.client.get(PR).pipe(Effect.flip);

	expect({ limited: githubRateLimited(limited), message: limited.message, retryAt: failureContext(limited).retryAt }).toEqual({
		limited: true,
		message: "GitHub is rate-limited until 1970-01-01T00:02:00.000Z",
		retryAt: EXHAUSTED_RESET * 1000,
	});
	expect(yield* github.client.observations()).toMatchObject([{ limitedBy: "rate-limit", limitedUntil: 120_000, remaining: 0, resource: "core" }]);
});

githubHost.it("an exhausted budget sends no request one second before its reset", [], function* (story) {
	const github = yield* story.api({ remaining: 0, reset: EXHAUSTED_RESET });
	github.reply(PR, { message: "API rate limit exceeded" }, { status: HttpStatus.fromLiteral("Forbidden") });
	expect(yield* github.read(PR)).toBe("limited until 120000");
	yield* story.elapse("119 seconds");

	const read = yield* github.read(PR);

	expect(read).toBe("limited until 120000");
	expect(github.statuses()).toEqual([`403 ${PR}`]);
});

githubHost.it("an exhausted budget calls again at its reset and clears the limit", [], function* (story) {
	const github = yield* story.api({ remaining: 0, reset: EXHAUSTED_RESET });
	github.reply(PR, { message: "API rate limit exceeded" }, { status: HttpStatus.fromLiteral("Forbidden") });
	expect(yield* github.read(PR)).toBe("limited until 120000");
	github.budget.remaining = 5000;
	github.reply(PR, { number: 7 });

	yield* story.elapse("120 seconds");
	const read = yield* github.read(PR);

	expect(read).toEqual({ number: 7 });
	expect(github.statuses()).toEqual([`403 ${PR}`, `200 ${PR}`]);
	expect(yield* github.client.observations()).toMatchObject([{ limitedBy: null, limitedUntil: null, resource: "core" }]);
});

githubHost.it("a call that leaves the budget below the 20% reserve pauses that resource until its reset", [], function* (story) {
	const github = yield* story.api({ remaining: RESERVE_EDGE, reset: RESERVE_RESET });
	github.reply(PR, { number: 7 });
	github.reply(`${PR}/files`, []);
	expect(yield* github.read(PR)).toEqual({ number: 7 });

	const files = yield* github.read(`${PR}/files`);
	const paused = yield* github.client.get(PR).pipe(Effect.flip);

	expect(files).toEqual([]);
	expect({ message: paused.message, retryAt: failureContext(paused).retryAt }).toEqual({
		message: "GitHub paused below the 20% reserve until 1970-01-01T00:10:00.000Z",
		retryAt: RESERVE_RESET * 1000,
	});
	expect(yield* github.client.observations()).toMatchObject([{ limitedBy: "reserve", limitedUntil: 600_000, remaining: 999, resource: "core" }]);
});

githubHost.it("below the 20% reserve Fleet makes no call to that resource until its reset, then calls conditionally", [], function* (story) {
	const github = yield* story.api({ remaining: RESERVE_EDGE, reset: RESERVE_RESET });
	github.reply(PR, { number: 7 });
	github.reply(`${PR}/files`, []);
	yield* github.read(PR);
	yield* github.read(`${PR}/files`);
	yield* story.elapse("599 seconds");
	expect(yield* github.read(`${PR}/files`)).toBe("limited until 600000");
	github.budget.remaining = 5000;

	yield* story.elapse("1 second");
	const read = yield* github.read(PR);

	expect(read).toEqual({ number: 7 });
	expect(github.statuses()).toEqual([`200 ${PR}`, `200 ${PR}/files`, `304 ${PR}`]);
});

githubHost.it("a secondary limit with retry-after waits that long", [], function* (story) {
	const github = yield* story.api();
	github.reply(PR, SECONDARY, { headers: { "Retry-After": "90" }, status: HttpStatus.fromLiteral("Forbidden") });

	const read = yield* github.read(PR);

	expect(read).toBe("limited until 90000");
});

githubHost.it("each further secondary limit without a retry time doubles the backoff", [], function* (story) {
	const github = yield* story.api();
	github.reply(PR, SECONDARY, { headers: { "Retry-After": "90" }, status: HttpStatus.fromLiteral("Forbidden") });
	yield* github.read(PR);
	yield* story.elapse("90 seconds");
	github.reply(PR, SECONDARY, { status: HttpStatus.fromLiteral("TooManyRequests") });
	expect(yield* github.read(PR)).toBe("limited until 210000");

	yield* story.elapse("120 seconds");
	const read = yield* github.read(PR);

	expect(read).toBe("limited until 450000");
	expect(github.statuses()).toEqual([`403 ${PR}`, `429 ${PR}`, `429 ${PR}`]);
});

githubHost.it("a success resets the secondary backoff, so the next limit waits one minute", [], function* (story) {
	const github = yield* story.api();
	github.reply(PR, SECONDARY, { status: HttpStatus.fromLiteral("TooManyRequests") });
	yield* github.read(PR);
	yield* story.elapse("120 seconds");
	yield* github.read(PR);
	yield* story.elapse("240 seconds");
	github.reply(PR, { number: 7 });
	expect(yield* github.read(PR)).toEqual({ number: 7 });
	github.reply(PR, SECONDARY, { status: HttpStatus.fromLiteral("TooManyRequests") });

	const read = yield* github.read(PR);

	expect(read).toBe("limited until 420000");
});

githubHost.it(
	"the REST budget keeps full speed above half, stretches the pace down to the reserve and waits for the reset below it",
	[],
	function* (story) {
		const interval = 15_000;
		const reset = 3600;
		const paces: number[] = [];
		for (const remaining of [5000, 2500, 2000, 1500, 1000, 999]) {
			const github = yield* story.api({ remaining: remaining + 1, reset });
			github.reply(PR, { number: 7 });
			const client = github.client;
			yield* client.get(PR);
			paces.push(yield* client.pace(interval));
		}
		const [full, half, stretched, slower, slowest, reserved] = paces;
		expect(full).toBe(interval);
		expect(half).toBe(interval);
		expect(stretched).toBeGreaterThan(interval);
		expect(slower).toBeGreaterThan(stretched ?? 0);
		expect(slowest).toBeGreaterThan(slower ?? 0);
		expect(slowest).toBe(5 * 60_000);
		expect(reserved).toBe(reset * 1000);
		expect(yield* (yield* story.api()).client.pace(interval)).toBe(interval);
	},
);

githubHost.it("a paged read stops before its next request would spend the reserve", [], function* (story) {
	const reset = 600;
	const reserve = 1000;
	const github = yield* story.api({ remaining: reserve, reset });
	const endpoint = `${PR}/files?per_page=100`;
	const next = `${endpoint}&page=2`;
	github.reply(endpoint, [{ filename: "one.ts" }], { headers: { Link: `</${next}>; rel="next"` } });
	github.reply(next, [{ filename: "two.ts" }]);
	const error = yield* github.client.pages(endpoint).pipe(Effect.flip);
	expect(failureContext(error).retryAt).toBe(reset * 1000);
	expect(github.requests.map(({ endpoint: path }) => path)).toEqual([endpoint]);
	expect(yield* github.client.observations()).toMatchObject([{ limitedBy: "reserve", remaining: reserve - 1 }]);
});
