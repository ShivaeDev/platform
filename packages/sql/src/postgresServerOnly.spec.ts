import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { credentialsIssued, type ServerOnlyRole, serverOnlyCredentials } from "#test/serverOnlyCredentials.ts";

serverOnlyCredentials.it(
	"an inserted server-only digest is stored as its plain text and read back as a Redacted that prints <redacted>",
	[],
	function* ({ credential, issue, storedDigests }) {
		yield* issue("alice", "digest-a");

		yield* outcomes([
			["stored digest column", () => storedDigests(), [["alice", "digest-a"]]],
			["alice's credential as read back", () => credential("alice"), { digest: { opened: "digest-a", printed: "<redacted>" }, owner: "alice" }],
		]);
	},
);

serverOnlyCredentials.it(
	"an update rewrites the stored digest and returns the new one as a Redacted",
	[credentialsIssued({ alice: "digest-a" })],
	function* ({ credential, rotate, storedDigests }) {
		expect(yield* storedDigests()).toEqual([["alice", "digest-a"]]);

		const returned = yield* rotate("alice", "digest-b");

		yield* outcomes([
			["returned digest", () => Effect.succeed(returned), { opened: "digest-b", printed: "<redacted>" }],
			["stored digest column", () => storedDigests(), [["alice", "digest-b"]]],
			["alice's credential as read back", () => credential("alice"), { digest: { opened: "digest-b", printed: "<redacted>" } }],
		]);
	},
);

serverOnlyCredentials.it(
	"a projection that selects only the server-only digest reads it as a Redacted",
	[credentialsIssued({ alice: "digest-a" })],
	function* ({ projected }) {
		expect(yield* projected("alice")).toEqual([{ opened: "digest-a", printed: "<redacted>" }]);
	},
);

serverOnlyCredentials.it(
	"an equality filter and an in-list filter on the server-only digest find the credentials that hold it",
	[credentialsIssued({ alice: "digest-a", bob: "digest-b", carol: "digest-c" })],
	function* ({ ownersWithDigest, ownersWithDigestIn }) {
		yield* outcomes([
			["owners with digest-b", () => ownersWithDigest("digest-b"), ["bob"]],
			["owners with digest-a or digest-c", () => ownersWithDigestIn(["digest-a", "digest-c"]), ["alice", "carol"]],
			["owners with an unknown digest", () => ownersWithDigest("digest-z"), []],
		]);
	},
);

serverOnlyCredentials.it(
	"an upsert on the server-only digest's unique constraint updates the holder and returns the digest as a Redacted",
	[credentialsIssued({ alice: "digest-a" })],
	function* ({ storedDigests, transferByDigest }) {
		const transferred = yield* transferByDigest("bob", "digest-a");

		yield* outcomes([
			["upsert result", () => Effect.succeed(transferred), { digest: { opened: "digest-a", printed: "<redacted>" }, inserted: false, owner: "bob" }],
			["stored digest column", () => storedDigests(), [["bob", "digest-a"]]],
		]);
	},
);

serverOnlyCredentials.it(
	"an insert that conflicts on the server-only digest is ignored and keeps the stored holder",
	[credentialsIssued({ alice: "digest-a" })],
	function* ({ reissueIgnoringTaken, storedDigests }) {
		const reissued = yield* reissueIgnoringTaken("bob", "digest-a");

		yield* outcomes([
			["insert", () => Effect.succeed(reissued), "ignored"],
			["stored digest column", () => storedDigests(), [["alice", "digest-a"]]],
		]);
	},
);

serverOnlyCredentials.it(
	"the newest credential per owner reads the server-only digest as a Redacted",
	[credentialsIssued({ alice: "digest-a", bob: "digest-b" })],
	function* ({ latestPerOwner }) {
		expect(yield* latestPerOwner()).toEqual([
			{ digest: { opened: "digest-a", printed: "<redacted>" }, owner: "alice" },
			{ digest: { opened: "digest-b", printed: "<redacted>" }, owner: "bob" },
		]);
	},
);

serverOnlyCredentials.it(
	"a batched delete filtered by the server-only digest removes only the credential that holds it",
	[credentialsIssued({ alice: "digest-a", bob: "digest-b" })],
	function* ({ revokeBatched, storedDigests }) {
		const removed = yield* revokeBatched("digest-a");

		yield* outcomes([
			["removed rows", () => Effect.succeed(removed), 1],
			["stored digest column", () => storedDigests(), [["bob", "digest-b"]]],
		]);
	},
);

for (const role of ["the ID column", "a bucket", "a tuple bucket column"] as const satisfies readonly ServerOnlyRole[]) {
	serverOnlyCredentials.it(
		`building a repository refuses a server-only field as ${role}, whose value would be announced as a change key`,
		[],
		function* ({ register }) {
			expect(yield* register(role)).toBe(
				'ServerOnlyKeyError: Repository for refused_credentials: server-only fields ["digest"] cannot be an ID column or a bucket, because their values would be announced as change keys; key the table by another column',
			);
		},
	);
}

serverOnlyCredentials.it(
	"a logged credential row and a defect that carries it print <redacted> for the server-only digest",
	[credentialsIssued({ alice: "digest-a" })],
	function* ({ loggedCredential }) {
		const { defect, logged } = yield* loggedCredential("alice");

		yield* outcomes([
			["recorded log message", () => Effect.succeed(logged), '[{"digest":"<redacted>","id":1,"owner":"alice"}]'],
			["defect report mentions the digest", () => Effect.succeed(defect.includes("digest-a")), false],
			["defect report shows the redacted digest", () => Effect.succeed(defect.includes('"digest":<redacted>')), true],
		]);
	},
);
