import { Effect } from "effect";
import { githubDelivery } from "#host/githubDelivery.ts";
import { engineScenario } from "#test/engineScenario.ts";
import { checkRun, githubFixture } from "#test/githubChecks.ts";
import { BASE, HEAD, MOVED, PR, resultFixture } from "#test/githubResult.ts";

export function pullRequestIsBehindMain() {
	return engineScenario("the pull request is conflict-free and behind main", () => {
		const adopted = resultFixture({
			after: { base: { ref: "main", sha: MOVED }, "changed_files": 1 },
			before: { "changed_files": 1 },
			files: [[{ filename: "src/one.ts" }]],
			mainHead: MOVED,
		});
		const github = githubFixture("example/repository");
		github.reply(HEAD, [[checkRun({ headSha: HEAD })]]);
		const checkedHeads: string[] = [];
		const open = {
			baseRefOid: BASE,
			headRefOid: HEAD,
			mergeable: "MERGEABLE",
			mergeCommit: null,
			mergedAt: null,
			mergeStateStatus: "BEHIND",
			state: "OPEN",
			url: PR,
		};
		let observation: unknown = open;
		return {
			context: {
				adopted,
				checkedHeads,
				github,
				get observation() {
					return observation;
				},
				set observation(value: typeof observation) {
					observation = value;
				},
				open,
			},
			options: {
				checksQuery: (result) => {
					checkedHeads.push(result.head);
					return github.checks(result);
				},
				deliveryQuery: githubDelivery(() => Effect.succeed(observation)),
				resultQuery: adopted.adopt,
			},
		};
	});
}
