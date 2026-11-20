import { Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { bodyExcerptDeadline } from "@shivaedev/http/bodyExcerpt.ts";
import type { FakeHttpReply } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { read } from "#read.ts";
import { appGithub } from "#test/appGithub.ts";
import { PullRequest } from "#test/fixtures.ts";
import { github } from "#test/github.ts";

export const holdsPooledInstallationToken = appGithub.trait(
	"github",
	"the pooled client already holds installation token 1",
	function* ({ contexts }) {
		yield* read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(contexts.pooled));
	},
);

const EXCERPT_DEADLINE_LINE = "one second passes once a status failure waits on its unfinished error body for an excerpt";
const excerptDeadlinePasses = untilTimer(bodyExcerptDeadline).pipe(
	Effect.andThen(TestClock.adjust(bodyExcerptDeadline)),
	Effect.forkScoped,
	Effect.asVoid,
);

export const errorExcerptDeadlinePasses = github.trait("github", EXCERPT_DEADLINE_LINE, () => excerptDeadlinePasses);
export const appErrorExcerptDeadlinePasses = appGithub.trait("github", EXCERPT_DEADLINE_LINE, () => excerptDeadlinePasses);

export function unfinishedPull(status: number, headers: Readonly<Record<string, string>> = {}) {
	return github.trait("github", `GitHub sends pull headers with status ${status} and holds the body`, function* ({ server }) {
		yield* server.scriptFault("pull", { kind: "status", reply: { headers, status } });
		yield* server.stall("pull");
	});
}

export const unfinishedChunkedPull = github.trait("github", "GitHub sends 16 bytes of pull JSON then holds the rest", function* ({ server }) {
	const gate = Promise.withResolvers<void>();
	yield* Effect.addFinalizer(() => Effect.sync(() => gate.resolve()));
	yield* server.scriptFault("pull", {
		kind: "status",
		reply: {
			chunks: (async function* () {
				yield "abcdefghijklmnop";
				await gate.promise;
			})(),
		},
	});
});

export function unfinishedAppResponse(route: "pull" | "token" | "installation", reply: FakeHttpReply) {
	return appGithub.trait("github", `GitHub sends ${route} headers then holds its body`, function* ({ server }) {
		const gate = Promise.withResolvers<void>();
		yield* Effect.addFinalizer(() => Effect.sync(() => gate.resolve()));
		yield* server.scriptFault(route, {
			kind: "status",
			reply: {
				...reply,
				chunks: (async function* () {
					yield "";
					await gate.promise;
				})(),
			},
		});
	});
}
