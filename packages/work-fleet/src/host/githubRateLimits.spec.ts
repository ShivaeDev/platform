import { expect } from "@effect/vitest";
import { Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { it } from "@shivaedev/effect-test/it.ts";
import { failureContext } from "#engine/failureContext.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubRateLimited } from "#host/githubRateLimit.ts";
import { syntheticGithub } from "#test/githubApi.ts";

const PR = "repos/example/project/pulls/7";

function api(github: ReturnType<typeof syntheticGithub>) {
	return GithubApi.pipe(Effect.provide(github.layer));
}

it.effect("records each response's rate-limit headers by resource with the time Fleet observed them", function* () {
	const github = syntheticGithub({ remaining: 4200, reset: 3600 });
	github.reply(PR, { number: 7 });
	const client = yield* api(github);
	expect(yield* client.observations()).toEqual([]);
	yield* TestClock.adjust("5 seconds");
	yield* client.get(PR);
	expect(yield* client.observations()).toEqual([
		{ limit: 5000, limitedBy: null, limitedUntil: null, observedAt: 5000, remaining: 4199, reset: 3600, resource: "core", used: 801 },
	]);
	expect(github.requests).toHaveLength(1);
});

it.effect("an unchanged resource is answered by a conditional request that spends no budget and keeps the cached body", function* () {
	const github = syntheticGithub();
	github.reply(PR, { number: 7, state: "open" });
	const client = yield* api(github);
	const first = yield* client.get(PR);
	const spent = github.budget.remaining;
	expect(yield* client.get(PR)).toBe(first);
	expect(yield* client.get(PR)).toBe(first);
	expect(github.budget.remaining).toBe(spent);
	expect(github.requests.map(({ status }) => status)).toEqual([200, 304, 304]);
	expect(github.requests[1]?.etag).toBeDefined();
	github.reply(PR, { number: 7, state: "closed" });
	expect(JSON.parse(yield* client.get(PR))).toEqual({ number: 7, state: "closed" });
	expect(github.budget.remaining).toBe(spent - 1);
});

it.effect("pages follow Link headers and every page is conditional", function* () {
	const github = syntheticGithub();
	const next = "https://api.github.com/repositories/1/pulls/7/files?per_page=100&page=2";
	github.reply(`${PR}/files?per_page=100`, [{ filename: "one.ts" }], { headers: { Link: `<${next}>; rel="next"` } });
	github.reply(next, [{ filename: "two.ts" }]);
	const client = yield* api(github);
	expect(JSON.parse(yield* client.pages(`${PR}/files?per_page=100`))).toEqual([[{ filename: "one.ts" }], [{ filename: "two.ts" }]]);
	expect(JSON.parse(yield* client.pages(`${PR}/files?per_page=100`))).toEqual([[{ filename: "one.ts" }], [{ filename: "two.ts" }]]);
	expect(github.requests.map(({ status }) => status)).toEqual([200, 200, 304, 304]);
});

it.effect("an exhausted budget stops every call to that resource until its reset", function* () {
	const github = syntheticGithub({ remaining: 0, reset: 120 });
	github.reply(PR, { message: "API rate limit exceeded" }, { status: 403 });
	const client = yield* api(github);
	const limited = yield* client.get(PR).pipe(Effect.flip);
	expect(githubRateLimited(limited)).toBe(true);
	expect(failureContext(limited).retryAt).toBe(120_000);
	expect(limited.message).toBe("GitHub is rate-limited until 1970-01-01T00:02:00.000Z");
	expect(yield* client.observations()).toMatchObject([{ limitedBy: "rate-limit", limitedUntil: 120_000, remaining: 0, resource: "core" }]);
	yield* TestClock.adjust("119 seconds");
	expect(githubRateLimited(yield* client.get(PR).pipe(Effect.flip))).toBe(true);
	expect(github.requests).toHaveLength(1);
	github.budget.remaining = 5000;
	github.reply(PR, { number: 7 });
	yield* TestClock.adjust("1 second");
	expect(JSON.parse(yield* client.get(PR))).toEqual({ number: 7 });
	expect(github.requests).toHaveLength(2);
	expect(yield* client.observations()).toMatchObject([{ limitedBy: null, limitedUntil: null, resource: "core" }]);
});

it.effect("below the 20% reserve Fleet makes no call to that resource until its reset", function* () {
	const github = syntheticGithub({ remaining: 1001, reset: 600 });
	github.reply(PR, { number: 7 });
	github.reply(`${PR}/files`, []);
	const client = yield* api(github);
	expect(JSON.parse(yield* client.get(PR))).toEqual({ number: 7 });
	expect(JSON.parse(yield* client.get(`${PR}/files`))).toEqual([]);
	expect(github.budget.remaining).toBe(999);
	const paused = yield* client.get(PR).pipe(Effect.flip);
	expect(githubRateLimited(paused)).toBe(true);
	expect(failureContext(paused).retryAt).toBe(600_000);
	expect(paused.message).toBe("GitHub paused below the 20% reserve until 1970-01-01T00:10:00.000Z");
	expect(yield* client.observations()).toMatchObject([{ limitedBy: "reserve", limitedUntil: 600_000, remaining: 999, resource: "core" }]);
	yield* TestClock.adjust("599 seconds");
	expect(githubRateLimited(yield* client.get(`${PR}/files`).pipe(Effect.flip))).toBe(true);
	expect(github.requests).toHaveLength(2);
	github.budget.remaining = 5000;
	yield* TestClock.adjust("1 second");
	expect(JSON.parse(yield* client.get(PR))).toEqual({ number: 7 });
	expect(github.requests).toHaveLength(3);
});

it.effect("a secondary limit waits for retry-after, or backs off from one minute when GitHub names no time", function* () {
	const github = syntheticGithub();
	github.reply(PR, { message: "You have exceeded a secondary rate limit" }, { headers: { "Retry-After": "90" }, status: 403 });
	const client = yield* api(github);
	expect(failureContext(yield* client.get(PR).pipe(Effect.flip)).retryAt).toBe(90_000);
	yield* TestClock.adjust("90 seconds");
	github.reply(PR, { message: "You have exceeded a secondary rate limit" }, { status: 429 });
	expect(failureContext(yield* client.get(PR).pipe(Effect.flip)).retryAt).toBe(90_000 + 120_000);
	yield* TestClock.adjust("120 seconds");
	expect(failureContext(yield* client.get(PR).pipe(Effect.flip)).retryAt).toBe(210_000 + 240_000);
	expect(github.requests).toHaveLength(3);
	yield* TestClock.adjust("240 seconds");
	github.reply(PR, { number: 7 });
	yield* client.get(PR);
	github.reply(PR, { message: "You have exceeded a secondary rate limit" }, { status: 429 });
	expect(failureContext(yield* client.get(PR).pipe(Effect.flip)).retryAt).toBe(450_000 + 60_000);
});

it.effect("the REST budget keeps full speed above half, stretches the pace down to the reserve and waits for the reset below it", function* () {
	const interval = 15_000;
	const paces: number[] = [];
	for (const remaining of [5000, 2500, 2000, 1500, 1000, 999]) {
		const github = syntheticGithub({ remaining: remaining + 1, reset: 3600 });
		github.reply(PR, { number: 7 });
		const client = yield* api(github);
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
	expect(reserved).toBe(3_600_000);
	expect(yield* (yield* api(syntheticGithub())).pace(interval)).toBe(interval);
});
