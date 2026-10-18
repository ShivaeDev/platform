import { expect } from "@effect/vitest";
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
export function reviewerNetwork() {
	const github = githubFixture();
	const pr = "https://github.com/example/project/pull/7";
	github.reply(ADOPTED_HEAD, [[checkRun()]]);
	const responses = new Map([...unslurped(github.responses)].map(([endpoint, body]) => [endpoint, httpOutput(200, {}, body)]));
	responses.set("headRefOid", JSON.stringify({ headRefOid: ADOPTED_HEAD }));
	responses.set(pr, "diff --git a/src/one.ts b/src/one.ts\n+export const answer = 42;\n");
	const cli = githubCli(responses);
	let output = "";
	return {
		inspect: Effect.gen(function* () {
			const result = githubResult();
			const head = yield* readCommand("gh", ["pr", "view", pr, "--json", "headRefOid"]);
			expect(JSON.parse(head)).toEqual({ headRefOid: result.head });
			const diff = yield* readCommand("gh", ["pr", "diff", pr]);
			const checks = yield* GithubApi.pipe(
				Effect.flatMap((api) => githubChecks(api)(result)),
				Effect.provide(githubApiLayer.pipe(Layer.provide(cli.layer))),
			);
			expect(diff).toContain("+export const answer = 42;");
			expect(checks.passed).toBe(true);
			output = `FLEET_REVIEW: ${JSON.stringify({ evidence: [diff, ...checks.evidence], findings: [], head: result.head, verdict: "approve" })}`;
			expect(cli.commands).toHaveLength(5);
			for (const command of cli.commands) {
				expect(command).toMatchObject({ command: "gh" });
				if (command._tag === "StandardCommand") {
					expect(
						command.args[0] === "pr"
							? ["view", "diff"].includes(command.args[1] ?? "")
							: command.args.slice(0, 4).join(" ") === "api --include --method GET",
					).toBe(true);
				}
			}
		}).pipe(Effect.provide(cli.layer)),
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
