import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { appGithub } from "#test/appGithub.ts";

appGithub.it(
	"a cached installation token rejected with 401 is exchanged and the resource request retries once",
	[],
	function* ({ readPull, rejectPull, exchanges, requests }) {
		yield* readPull();
		yield* rejectPull();
		expect(yield* readPull()).toEqual({ number: 1, title: "App read" });
		expect(exchanges()).toMatchObject([
			{ method: "POST", path: "/app/installations/7/access_tokens" },
			{ method: "POST", path: "/app/installations/7/access_tokens" },
		]);
		const reads = requests().filter(({ path }) => path === "/repos/acme/widgets/pulls/1");
		expect(reads.map(({ status }) => status)).toEqual([200, 401, 200]);
		expect(reads[1]?.headers.authorization).toBe(reads[0]?.headers.authorization);
		expect(reads[2]?.headers.authorization).not.toBe(reads[0]?.headers.authorization);
	},
);

appGithub.it("a second resource 401 fails typed after exactly one refresh", [], function* ({ readPull, rejectPull, exchanges, requests }) {
	yield* readPull();
	yield* rejectPull();
	yield* rejectPull();
	expect(yield* Effect.flip(readPull())).toMatchObject({ _tag: "RemoteUnauthorized", method: "GET", status: 401 });
	expect(exchanges()).toMatchObject([
		{ method: "POST", path: "/app/installations/7/access_tokens" },
		{ method: "POST", path: "/app/installations/7/access_tokens" },
	]);
	expect(
		requests()
			.filter(({ path }) => path === "/repos/acme/widgets/pulls/1")
			.map(({ status }) => status),
	).toEqual([200, 401, 401]);
});

appGithub.it(
	"concurrent 401s for the same cached token share one replacement exchange",
	[],
	function* ({ readPull, rejectPull, holdPulls, awaitPulls, holdExchange, exchanges, requests }) {
		yield* readPull();
		const readers = 6;
		for (let index = 0; index < readers; index += 1) {
			yield* rejectPull();
		}
		const resources = yield* holdPulls();
		const exchange = yield* holdExchange();
		const pending = yield* Effect.all(
			Array.from({ length: readers }, () => readPull()),
			{ concurrency: "unbounded" },
		).pipe(Effect.forkChild);
		yield* awaitPulls(readers + 1);
		yield* resources.release;
		yield* exchange.waiting;
		expect(exchanges()).toMatchObject([
			{ method: "POST", path: "/app/installations/7/access_tokens" },
			{ method: "POST", path: "/app/installations/7/access_tokens" },
		]);
		yield* exchange.release;
		expect(yield* Fiber.join(pending)).toEqual(Array.from({ length: readers }, () => ({ number: 1, title: "App read" })));
		expect(exchanges()).toMatchObject([
			{ method: "POST", path: "/app/installations/7/access_tokens" },
			{ method: "POST", path: "/app/installations/7/access_tokens" },
		]);
		const unauthorized = requests().filter(({ status }) => status === 401);
		expect(unauthorized).toHaveLength(readers);
		expect([...new Set(unauthorized.map(({ headers }) => headers.authorization))]).toEqual([requests()[1]?.headers.authorization]);
	},
);

appGithub.it(
	"an artifact request refreshes a rejected installation token before downloading without credentials",
	[],
	function* ({ readPull, rejectArchive, downloadArchive, exchanges, requests }) {
		yield* readPull();
		yield* rejectArchive();
		expect(new TextDecoder().decode(yield* downloadArchive())).toBe("archive");
		expect(exchanges()).toMatchObject([
			{ method: "POST", path: "/app/installations/7/access_tokens" },
			{ method: "POST", path: "/app/installations/7/access_tokens" },
		]);
		const redirects = requests().filter(({ path }) => path === "/repos/acme/widgets/actions/artifacts/42/zip");
		expect(redirects.map(({ status }) => status)).toEqual([401, 302]);
		expect(redirects[1]?.headers.authorization).not.toBe(redirects[0]?.headers.authorization);
		expect(requests().filter(({ path }) => path === "/storage/archive")).toMatchObject([{ path: "/storage/archive", status: 200 }]);
		expect(requests().find(({ path }) => path === "/storage/archive")?.headers.authorization).toBeUndefined();
	},
);
