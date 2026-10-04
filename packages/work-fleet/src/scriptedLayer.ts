import { Effect, Layer } from "effect";
import type { AgentResult, Outcome, PullRequest } from "./domain.ts";
import { Agent, ChangeHost } from "./ports.ts";

const REVISION = "0123456789abcdef0123456789abcdef01234567";
function resultFor(request: Parameters<typeof Agent.Service.launch>[0]): AgentResult {
	return request.attempt.role === "reviewer"
		? {
				kind: "review",
				revision: request.attempt.revision ?? REVISION,
				summary: "Scripted independent review approved this synthetic revision.",
				verdict: "approve",
			}
		: {
				kind: "outcome",
				outcome:
					request.work.completion === "no-change"
						? { justification: "Scripted verification found the synthetic requirement already satisfied.", kind: "no-change", revision: REVISION }
						: { kind: "branch", revision: REVISION },
			};
}
function pr(repository: string): Extract<
	Outcome,
	{
		kind: "pull-request";
	}
> {
	return {
		kind: "pull-request",
		number: 1,
		revision: REVISION,
		url: `https://github.com/${repository}/pull/1`,
	};
}
export function scriptedLayer() {
	const merged = new Set<string>();
	return Layer.merge(
		Layer.succeed(Agent, {
			backendId: "scripted",
			launch: (request, acknowledge) =>
				Effect.gen(function* () {
					const ref = { sessionId: request.attempt.ref?.sessionId ?? `scripted-${request.attempt.id}`, turnId: request.attempt.id };
					yield* acknowledge(ref);
					return { ref, status: "pending" as const };
				}),
			observe: (request) =>
				Effect.succeed({
					ref: request.attempt.ref ?? { sessionId: `scripted-${request.attempt.id}`, turnId: request.attempt.id },
					result: resultFor(request),
					status: "completed",
				}),
		}),
		Layer.succeed(ChangeHost, {
			backendId: "scripted",
			findPublished: (work) => Effect.succeed(pr(work.repository)),
			merge: (work) =>
				Effect.sync(() => {
					merged.add(work.id);
				}),
			observe: (work, number) =>
				Effect.succeed({
					baseRevision: REVISION,
					checks: work.requiredChecks.map((name) => ({ name, status: "passed" })),
					mergeable: "ready",
					number,
					revision: REVISION,
					state: merged.has(work.id) ? "merged" : "open",
					url: pr(work.repository).url,
				} satisfies PullRequest),
			publish: (work) => Effect.succeed(pr(work.repository)),
			verifyChange: () => Effect.void,
			verifyNoChange: () => Effect.void,
		}),
	);
}
