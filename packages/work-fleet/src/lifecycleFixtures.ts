import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { Effect, Layer } from "effect";
import { makeEffectIt } from "@shivaedev/effect-test";
import { databaseLayer } from "#databaseLayer.ts";
import type { AgentResult, PullRequest, WorkSpec } from "#domain.ts";
import { Fleet } from "#Fleet.ts";
import { Agent, type AgentRequest, ChangeHost, failure, type Observation } from "#ports.ts";
import { Store } from "#Store.ts";
export function spec(id: string, completion: WorkSpec["completion"] = "merged"): WorkSpec {
	return {
		baseBranch: "main",
		checkout: `/tmp/fleet-fixture-${id}`,
		completion,
		id,
		instructions: `Implement ${id}`,
		repository: "example/project",
		requiredChecks: ["test"],
		scope: [{ key: null, path: `src/${id}.ts` }],
	};
}
export function pullRequest(revision = "head-1"): PullRequest {
	return {
		baseRevision: "base-1",
		checks: [{ name: "test", status: "passed" }],
		mergeable: "ready",
		number: 1,
		revision,
		state: "open",
		url: "https://github.com/example/project/pull/1",
	};
}
export function outcome(revision = "head-1"): AgentResult {
	return {
		kind: "outcome",
		outcome: { kind: "pull-request", number: 1, revision, url: "https://github.com/example/project/pull/1" },
	};
}
export function review(verdict: "approve" | "repair" = "approve", revision = "head-1"): AgentResult {
	return {
		kind: "review",
		revision,
		summary: verdict === "approve" ? "Scoped behavior verified" : "Correct the edge case",
		verdict,
	};
}
export const noChange: AgentResult = {
	kind: "outcome",
	outcome: { justification: "The requested behavior already exists and passed the scoped check", kind: "no-change", revision: "head-1" },
};
const fixture = Effect.sync(() => {
	const launches: AgentRequest[] = [];
	const observations = new Map<string, Observation>();
	const merges: string[] = [];
	const verifications: string[] = [];
	const changeVerifications: string[] = [];
	let reviewerSession: string | undefined;
	let pr = pullRequest();
	let uncertain = false;
	const agent: typeof Agent.Service = {
		backendId: "test",
		launch: (request, acknowledge) =>
			Effect.gen(function* () {
				launches.push(request);
				const ref = {
					sessionId:
						(request.attempt.role === "reviewer" ? reviewerSession : undefined) ?? request.attempt.ref?.sessionId ?? `session-${request.attempt.id}`,
					turnId: `turn-${request.attempt.id}`,
				};
				const pending = { ref, status: "pending" } satisfies Observation;
				observations.set(request.attempt.id, pending);
				yield* acknowledge(ref);
				if (uncertain) {
					return yield* Effect.fail(failure("Acknowledged request lost its response"));
				}
				return pending;
			}),
		observe: (request) =>
			Effect.sync(() => observations.get(request.attempt.id) ?? { message: "Provider cannot locate this intent", status: "unknown" }),
	};
	const host: typeof ChangeHost.Service = {
		backendId: "test",
		findPublished: () => Effect.succeed(null),
		merge: (work) =>
			Effect.sync(() => {
				merges.push(work.id);
			}),
		observe: () => Effect.sync(() => pr),
		publish: () => Effect.fail(failure("Unexpected publication")),
		verifyChange: (work) =>
			Effect.sync(() => {
				changeVerifications.push(work.id);
			}),
		verifyNoChange: (work) =>
			Effect.sync(() => {
				verifications.push(work.id);
			}),
	};
	function layer(filename = ":memory:", backendId = "test", overrides: Partial<typeof ChangeHost.Service> = {}) {
		return Fleet.layer.pipe(
			Layer.provideMerge(Store.layer.pipe(Layer.provide(databaseLayer(filename)))),
			Layer.provide(Layer.merge(Layer.succeed(Agent, { ...agent, backendId }), Layer.succeed(ChangeHost, { ...host, ...overrides }))),
		);
	}
	return {
		changeVerifications,
		finish: (id: string, result: AgentResult) =>
			Effect.sync(() => {
				const current = observations.get(id);
				if (!current || current.status === "unknown") {
					throw new Error(`Missing fixture attempt ${id}`);
				}
				observations.set(id, { ref: current.ref, result, status: "completed" });
			}),
		launches,
		layer,
		merges,
		observeAttempt: (id: string, value: Observation) =>
			Effect.sync(() => {
				observations.set(id, value);
			}),
		observePr: (value: PullRequest) =>
			Effect.sync(() => {
				pr = value;
			}),
		reviewerSession: (value: string) =>
			Effect.sync(() => {
				reviewerSession = value;
			}),
		uncertain: (value: boolean) =>
			Effect.sync(() => {
				uncertain = value;
			}),
		verifications,
	};
});
export const { effectApp } = makeEffectIt({ layer: NodeFileSystem.layer, makeHarness: () => fixture });
export function approve(works: readonly WorkSpec[]) {
	return Effect.gen(function* () {
		const fleet = yield* Fleet;
		yield* fleet.accept({ id: "batch", works });
		for (const work of works) {
			yield* fleet.decide(work.id, "approve", "Approved finite scope");
		}
	});
}
