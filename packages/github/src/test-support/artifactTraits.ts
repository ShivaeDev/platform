import { Effect } from "effect";
import { github } from "./github.ts";

export function unavailableArtifact(status: 404 | 410) {
	return github.trait("github", `the artifact archive is ${status === 404 ? "missing" : "expired"}`, ({ archive }) => {
		archive.redirect = { status };
	});
}

export const archiveWithHeldTail = github.trait("github", "storage streams an archive with its tail held back", function* ({ archive }) {
	const tail = Promise.withResolvers<void>();
	yield* Effect.addFinalizer(() => Effect.sync(() => tail.resolve()));
	archive.archive = {
		chunks: (async function* () {
			const first = new Uint8Array([80, 75, 3, 4, 0, 255, 10, 13]);
			archive.sentBytes += first.byteLength;
			yield first;
			await tail.promise;
			const last = new Uint8Array(1024);
			archive.sentBytes += last.byteLength;
			yield last;
		})(),
	};
});
