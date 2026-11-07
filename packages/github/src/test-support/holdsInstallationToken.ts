import { Effect } from "effect";
import { read } from "#read.ts";
import { appGithub } from "#test/appGithub.ts";
import { PullRequest } from "#test/fixtures.ts";

export const holdsInstallationToken = appGithub.trait(
	"github",
	"the background client already holds installation token 1 from an earlier read",
	function* ({ contexts }) {
		yield* read("/repos/acme/widgets/pulls/1", PullRequest).pipe(Effect.provide(contexts.background));
	},
);
