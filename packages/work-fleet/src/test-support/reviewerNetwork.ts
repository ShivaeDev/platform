import { expect } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { githubChecks } from "#host/githubChecks.ts";
import { githubRead } from "#host/githubRead.ts";
import { reviewerPrompt } from "#prompt/reviewer.ts";
import { WireRejection, type WireRequest } from "#test/codex.ts";
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
	github.responses.set("headRefOid", JSON.stringify({ headRefOid: ADOPTED_HEAD }));
	github.responses.set(pr, "diff --git a/src/one.ts b/src/one.ts\n+export const answer = 42;\n");
	const cli = githubCli(github.responses);
	let output = "";
	return {
		inspect: Effect.gen(function* () {
			const result = githubResult();
			const head = yield* githubRead(["pr", "view", pr, "--json", "headRefOid"]);
			expect(JSON.parse(head)).toEqual({ headRefOid: result.head });
			const diff = yield* githubRead(["pr", "diff", pr]);
			const checks = yield* githubChecks(result);
			expect(diff).toContain("+export const answer = 42;");
			expect(checks.passed).toBe(true);
			output = `FLEET_REVIEW: ${JSON.stringify({ evidence: [diff, ...checks.evidence], findings: [], head: result.head, verdict: "approve" })}`;
			expect(cli.commands).toHaveLength(4);
			for (const command of cli.commands) {
				expect(command).toMatchObject({ command: "gh" });
				if (command._tag === "StandardCommand") {
					expect(
						command.args[0] === "pr" ? ["view", "diff"].includes(command.args[1] ?? "") : command.args.slice(0, 3).join(" ") === "api --method GET",
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
