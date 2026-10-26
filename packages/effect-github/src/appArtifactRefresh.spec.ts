import { Effect } from "effect";
import { expect } from "vitest";
import { appGithub } from "#test/appGithub.ts";

appGithub.it(
	"an archive download refreshes a rejected installation token and retries once",
	[],
	function* ({ downloadArchive, rejectArchive, exchanges, requests }) {
		yield* downloadArchive(8);
		yield* rejectArchive();
		expect(yield* downloadArchive(8)).toEqual(new Uint8Array([80, 75, 3, 4, 0, 255, 10, 13]));
		expect(exchanges()).toMatchObject([
			{ method: "POST", path: "/app/installations/7/access_tokens" },
			{ method: "POST", path: "/app/installations/7/access_tokens" },
		]);
		const redirects = requests().filter(({ path }) => path === "/repos/acme/widgets/actions/artifacts/7/zip");
		expect(redirects.map(({ status }) => status)).toEqual([302, 401, 302]);
		expect(redirects[1]?.headers.authorization).toBe(redirects[0]?.headers.authorization);
		expect(redirects[2]?.headers.authorization).not.toBe(redirects[0]?.headers.authorization);
		expect(
			requests()
				.filter(({ path }) => path.startsWith("/storage/"))
				.map(({ status }) => status),
		).toEqual([200, 200]);
	},
);

appGithub.it(
	"a second archive 401 fails typed after one installation token refresh",
	[],
	function* ({ downloadArchive, rejectArchive, exchanges, requests }) {
		yield* downloadArchive(8);
		yield* rejectArchive();
		yield* rejectArchive();
		expect(yield* Effect.flip(downloadArchive(8))).toMatchObject({ _tag: "RemoteUnauthorized", method: "GET", status: 401 });
		expect(exchanges()).toMatchObject([
			{ method: "POST", path: "/app/installations/7/access_tokens" },
			{ method: "POST", path: "/app/installations/7/access_tokens" },
		]);
		expect(
			requests()
				.filter(({ path }) => path === "/repos/acme/widgets/actions/artifacts/7/zip")
				.map(({ status }) => status),
		).toEqual([302, 401, 401]);
		expect(
			requests()
				.filter(({ path }) => path.startsWith("/storage/"))
				.map(({ status }) => status),
		).toEqual([200]);
	},
);
