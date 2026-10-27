import { Effect } from "effect";
import { expect } from "vitest";
import { GitHubArtifactError, GitHubArtifactTooLarge } from "#errors.ts";
import { archiveWithHeldTail, unavailableArtifact } from "#test/artifactTraits.ts";
import { FIXTURE_TOKEN } from "#test/fixtures.ts";
import { github } from "#test/github.ts";

github.it("an archive 401 with a plain token fails without retrying", [], function* ({ downloadArchive, rejectArchive, requests }) {
	yield* rejectArchive();
	expect(yield* Effect.flip(downloadArchive(8))).toMatchObject({ _tag: "RemoteUnauthorized", method: "GET", status: 401 });
	expect(requests().map(({ path, status }) => ({ path, status }))).toEqual([{ path: "/repos/acme/widgets/actions/artifacts/7/zip", status: 401 }]);
});

github.it(
	"downloads the archive within the caller's byte cap without forwarding credentials, even to the same origin",
	[],
	function* ({ downloadArchive, requests }) {
		expect(yield* downloadArchive(8)).toEqual(new Uint8Array([80, 75, 3, 4, 0, 255, 10, 13]));
		expect(requests().map(({ path }) => path)).toEqual([
			"/repos/acme/widgets/actions/artifacts/7/zip",
			"/storage/archive.zip?signature=storage-secret",
		]);
		expect(requests()[0]?.headers.authorization).toBe(`Bearer ${FIXTURE_TOKEN}`);
		expect(requests()[1]?.headers).not.toHaveProperty("authorization");
		expect(requests()[1]?.headers).not.toHaveProperty("x-github-api-version");
	},
);

github.it(
	"fails typed on a chunked archive over the cap before storage sends the tail",
	[archiveWithHeldTail],
	function* ({ downloadArchive, archiveBytesSent }) {
		const byteLimit = 7;
		expect(yield* Effect.flip(downloadArchive(byteLimit))).toEqual(new GitHubArtifactTooLarge({ limit: byteLimit }));
		expect(archiveBytesSent()).toBe(byteLimit + 1);
	},
);

for (const status of [404, 410] as const) {
	github.it(
		`fails typed for a ${status === 404 ? "missing" : "expired"} artifact without requesting storage`,
		[unavailableArtifact(status)],
		function* ({ downloadArchive, requests }) {
			expect(yield* Effect.flip(downloadArchive(8))).toEqual(new GitHubArtifactError({ stage: "redirect", status }));
			expect(requests().map(({ path }) => path)).toEqual(["/repos/acme/widgets/actions/artifacts/7/zip"]);
		},
	);
}
