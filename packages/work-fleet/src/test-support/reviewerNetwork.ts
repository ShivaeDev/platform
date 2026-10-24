import { Effect, Layer, Schema } from "effect";
import { GithubApi, githubApiLayer } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { readCommand } from "#host/readCommand.ts";
import { reviewerPrompt } from "#prompt/reviewer.ts";
import { WireRejection, type WireRequest } from "#test/codex.ts";
import { httpOutput, unslurped } from "#test/githubApi.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";
import { githubCli } from "#test/githubCli.ts";

const TurnAccess = Schema.Struct({
	approvalPolicy: Schema.Literal("never"),
	sandboxPolicy: Schema.Struct({ networkAccess: Schema.Literal(true), type: Schema.Literal("readOnly") }),
});
export function reviewerNetwork(tell: (line: string) => void) {
	const github = githubFixture();
	const pr = "https://github.com/example/project/pull/7";
	github.reply(ADOPTED_HEAD, [[checkRun()]]);
	const responses = new Map([...unslurped(github.responses)].map(([endpoint, body]) => [endpoint, httpOutput(200, {}, body)]));
	responses.set("headRefOid", JSON.stringify({ headRefOid: ADOPTED_HEAD }));
	responses.set(pr, "diff --git a/src/one.ts b/src/one.ts\n+export const answer = 42;\n");
	const cli = githubCli(responses);
	let output = "";
	return {
		answer: (head: string, evidence: readonly string[]) => {
			tell("the reviewer provider returns its verdict");
			output = `FLEET_REVIEW: ${JSON.stringify({ evidence, findings: [], head, verdict: "approve" })}`;
		},
		checks: () => {
			tell("read the pull request checks through GitHub");
			return GithubApi.pipe(
				Effect.flatMap((api) => githubChecks(api)(githubResult())),
				Effect.provide(githubApiLayer.pipe(Layer.provide(cli.layer))),
			);
		},
		commands: () => cli.commands,
		diff: () => {
			tell("read the pull request diff");
			return readCommand("gh", ["pr", "diff", pr]).pipe(Effect.provide(cli.layer));
		},
		head: () => {
			tell("read the pull request head");
			return readCommand("gh", ["pr", "view", pr, "--json", "headRefOid"]).pipe(Effect.provide(cli.layer));
		},
		prompt: reviewerPrompt({ result: githubResult(), task: "Prove that the exported answer is 42 and inspect CI." }),
		reply: (request: WireRequest) => {
			if (request.method === "turn/start") {
				return Schema.is(TurnAccess)(request.params) ? { turn: { id: "review-turn" } } : new WireRejection("Reviewer cannot read remote evidence");
			}
			if (request.method === "thread/turns/list") {
				return { data: [{ id: "review-turn", items: [], status: "completed" }], nextCursor: null };
			}
			if (request.method === "thread/items/list") {
				return { data: [{ item: { id: "verdict", phase: "final_answer", text: output, type: "agentMessage" } }], nextCursor: null };
			}
			return {};
		},
	};
}
