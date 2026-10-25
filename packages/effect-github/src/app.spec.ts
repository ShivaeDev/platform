import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { GitHubAppError } from "#errors.ts";
import { APP_ID } from "#test/appFixture.ts";
import { appGithub } from "#test/appGithub.ts";

appGithub.it("installation tokens authenticate reads, are reused, and refresh five minutes before expiry", [], function* ({ readPull, exchanges }) {
	expect(yield* readPull()).toEqual({ number: 1, title: "App read" });
	yield* TestClock.adjust("54 minutes");
	yield* readPull();
	expect(exchanges()).toMatchObject([{ method: "POST", path: "/app/installations/7/access_tokens" }]);
	yield* TestClock.adjust("1 minute");
	yield* readPull();
	expect(exchanges()).toMatchObject([
		{ method: "POST", path: "/app/installations/7/access_tokens" },
		{ method: "POST", path: "/app/installations/7/access_tokens" },
	]);
});

appGithub.it("concurrent reads at the refresh point share one in-flight token exchange", [], function* ({ readPull, exchanges, holdExchange }) {
	yield* readPull();
	yield* TestClock.adjust("55 minutes");
	const hold = yield* holdExchange();
	const concurrentReaders = 12;
	const readers = yield* Effect.all(
		Array.from({ length: concurrentReaders }, () => readPull()),
		{ concurrency: "unbounded" },
	).pipe(Effect.forkChild);
	yield* hold.waiting;
	expect(exchanges()).toMatchObject([
		{ method: "POST", path: "/app/installations/7/access_tokens" },
		{ method: "POST", path: "/app/installations/7/access_tokens" },
	]);
	yield* hold.release;
	expect(yield* Fiber.join(readers)).toEqual(Array.from({ length: concurrentReaders }, () => ({ number: 1, title: "App read" })));
	expect(exchanges()).toMatchObject([
		{ method: "POST", path: "/app/installations/7/access_tokens" },
		{ method: "POST", path: "/app/installations/7/access_tokens" },
	]);
});

appGithub.it("repository installation lookup and token exchange carry verifiable RS256 App JWTs", [], function* ({ readRepository, requests, jwts }) {
	yield* TestClock.adjust("2 minutes");
	expect(yield* readRepository()).toEqual({ number: 1, title: "App read" });
	expect(requests().map(({ method, path }) => ({ method, path }))).toEqual([
		{ method: "GET", path: "/repos/acme/widgets/installation" },
		{ method: "POST", path: "/app/installations/7/access_tokens" },
		{ method: "GET", path: "/repos/acme/widgets/pulls/1" },
	]);
	expect(jwts()).toMatchObject([{ claims: { iss: APP_ID } }, { claims: { iss: APP_ID } }]);
	for (const jwt of jwts()) {
		expect(jwt.valid).toBe(true);
		expect(jwt.header).toEqual({ alg: "RS256", typ: "JWT" });
		expect(jwt.claims.iss).toBe(APP_ID);
		expect(jwt.claims.iat).toBe(jwt.now - 60);
		expect(jwt.claims.exp).toBeGreaterThan(jwt.now);
		expect(jwt.claims.exp).toBeLessThanOrEqual(jwt.now + 600);
	}
});

appGithub.it("an unauthorized exchange fails typed without issuing the API read", [], function* ({ rejectExchange, readPull, requests }) {
	yield* rejectExchange();
	expect(yield* Effect.flip(readPull())).toEqual(new GitHubAppError({ stage: "exchange", status: 401 }));
	expect(requests().map(({ path }) => path)).toEqual(["/app/installations/7/access_tokens"]);
});
