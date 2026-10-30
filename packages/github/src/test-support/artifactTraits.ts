import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { ARCHIVE } from "./artifactFixture.ts";
import { github } from "./github.ts";

export function unavailableArtifact(state: "missing" | "expired") {
	const status = state === "missing" ? HttpStatus.fromLiteral("NotFound") : HttpStatus.fromLiteral("Gone");
	return github.trait("github", `artifact 7 is ${state}, so GitHub answers its archive with ${status}`, ({ archive }) => {
		archive.redirect = { status };
	});
}

export const archiveRejected = github.trait("github", "GitHub answers the next archive request with 401 Bad credentials", function* ({ server }) {
	yield* server.replyOnce("artifactRedirect", { body: { message: "Bad credentials" }, status: HttpStatus.fromLiteral("Unauthorized") });
});

export const storageSignatureExpired = github.trait(
	"github",
	"the signed storage link has expired, so storage answers 403 AuthenticationFailed",
	({ archive }) => {
		archive.archive = {
			chunks: ['<?xml version="1.0" encoding="utf-8"?><Error><Code>AuthenticationFailed</Code></Error>'],
			headers: { "content-type": "application/xml" },
			status: HttpStatus.fromLiteral("Forbidden"),
		};
	},
);

export const storageHoldsTail = github.trait(
	"github",
	"storage sends the archive's first 8 bytes and holds back its 1 KiB tail",
	function* ({ archive }) {
		const tail = Promise.withResolvers<void>();
		yield* Effect.addFinalizer(() => Effect.sync(() => tail.resolve()));
		archive.archive = {
			chunks: (async function* () {
				yield ARCHIVE;
				await tail.promise;
				yield new Uint8Array(1024);
			})(),
		};
	},
);
