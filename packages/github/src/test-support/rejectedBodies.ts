import { Effect } from "effect";
import type { FakeHttpReply } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { read } from "#GitHub.ts";
import { appGithub } from "./appGithub.ts";
import { PullRequest } from "./fixtures.ts";
import { github } from "./github.ts";

export const holdsPooledInstallationToken = appGithub.trait(
	"github",
	"the pooled client already holds installation token 1",
	function* ({ contexts }) {
		yield* read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(contexts.pooled));
	},
);

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
