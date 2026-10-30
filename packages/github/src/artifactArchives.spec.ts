import { expect } from "vitest";
import { ARCHIVE } from "#test/artifactFixture.ts";
import { archiveRejected, storageHoldsTail, storageSignatureExpired, unavailableArtifact } from "#test/artifactTraits.ts";
import { github } from "#test/github.ts";

github.it(
	"an archive download GitHub answers 401 for the configured token is not retried",
	[archiveRejected],
	function* ({ downloadArchive, requests }) {
		yield* downloadArchive();

		expect(yield* requests()).toEqual(["GET /repos/acme/widgets/actions/artifacts/7/zip 401"]);
	},
);

github.it("downloading artifact 7 follows GitHub's redirect to storage and returns the archive bytes", [], function* ({ downloadArchive }) {
	expect(yield* downloadArchive()).toEqual(ARCHIVE);
});

github.it(
	"an archive download sends the configured token and API version to GitHub but neither to storage, though storage shares GitHub's origin",
	[],
	function* ({ archiveRequestHeaders, downloadArchive }) {
		yield* downloadArchive();

		expect(yield* archiveRequestHeaders()).toEqual([
			{ apiVersion: "2022-11-28", credential: "the configured token", to: "GitHub" },
			{ apiVersion: "none", credential: "no credential", to: "storage" },
		]);
	},
);

github.it(
	"an archive over the caller's 7-byte cap fails as too large before storage sends the rest",
	[storageHoldsTail],
	function* ({ downloadArchive }) {
		expect(yield* downloadArchive(7)).toBe("archive over 7 bytes");
	},
);

github.it(
	"an archive download whose expired storage link storage refuses with 403 fails as the download answering HTTP 403",
	[storageSignatureExpired],
	function* ({ downloadArchive }) {
		expect(yield* downloadArchive()).toBe("artifact download answered HTTP 403");
	},
);

for (const [state, status] of [
	["missing", 404],
	["expired", 410],
] as const) {
	github.it(
		`downloading ${state} artifact 7 fails as the redirect answering HTTP ${status}`,
		[unavailableArtifact(state)],
		function* ({ downloadArchive }) {
			expect(yield* downloadArchive()).toBe(`artifact redirect answered HTTP ${status}`);
		},
	);
}
