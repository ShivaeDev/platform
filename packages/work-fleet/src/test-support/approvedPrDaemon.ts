import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Clock, Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { fleetHealth } from "@shivaedev/work-board/server/diagnostics/fleetHealth.ts";
import { responseMarkdown } from "@shivaedev/work-board/server/responses/records.ts";
import { daemonLayer } from "#host/daemon.ts";
import type { FleetRecord } from "#model.ts";
import { FleetIntegrations } from "#policy.ts";
import { until } from "#test/cloudRestart.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { HEAD, PR, REPORT } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { mainObservation, prepared } from "#test/preparation.ts";

export type PrDaemonClient = Effect.Success<ReturnType<typeof daemonClient>>;

export function schedulerReady(root: string, previous: number | null) {
	return until(() =>
		fleetHealth(root).pipe(
			Effect.map((health) => health.lastSchedulerPass !== null && health.lastSchedulerPass !== previous),
			Effect.provide(NodeServices.layer),
		),
	);
}

export function approvedPrFixture(fixture: HostFixture, github: Effect.Success<ReturnType<typeof mergedReviewGithub>>) {
	const parts = {
		...fixture.parts,
		integrations: Layer.succeed(FleetIntegrations)({
			checks: (_work, result) => github.checksQuery(result),
			delivery: github.deliveryQuery,
			main: (preparation) =>
				Clock.currentTimeMillis.pipe(Effect.map((observedAt) => mainObservation({ fromRevision: preparation.baseRevision, observedAt }))),
			result: github.resultQuery,
		}),
	};
	let responses = 0;
	const started = Effect.fn("ApprovedPrTest.started")(function* (client: PrDaemonClient, role: "worker" | "repair") {
		yield* until(() =>
			client("fleet.get", { workId: "one" }).pipe(
				Effect.map((record) => record.attempts.at(-1)?.role === role && record.attempts.at(-1)?.receipt !== undefined),
			),
		);
		return yield* client("fleet.get", { workId: "one" });
	});
	function serve<A, E>(use: (client: PrDaemonClient, port: number) => Effect.Effect<A, E>) {
		return Effect.scoped(
			Effect.gen(function* () {
				const previous = yield* fleetHealth(fixture.host.boardDir).pipe(Effect.option, Effect.provide(NodeServices.layer));
				const context = yield* Layer.build(Layer.fresh(daemonLayer(fixture.host, parts, 0)));
				yield* schedulerReady(fixture.host.boardDir, previous._tag === "Some" ? previous.value.lastSchedulerPass : null);
				const url = HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address);
				return yield* use(yield* daemonClient(url), Number(new URL(url).port));
			}),
		);
	}
	function finishWorker(record: FleetRecord, head = HEAD) {
		const receipt = record.attempts.at(-1)?.receipt;
		const observation = receipt === undefined ? undefined : fixture.provider.observations.get(receipt.turnId);
		if (observation === undefined) {
			throw new Error(`Missing worker observation: ${record.stage}, ${record.blocker ?? "no blocker"}`);
		}
		github.state.head = head;
		fixture.provider.observations.set(observation.receipt.turnId, { ...observation, execution: "completed", output: REPORT.replace(HEAD, head) });
	}
	const ready = Effect.fn("ApprovedPrTest.ready")(function* (client: PrDaemonClient) {
		fixture.write("one.md", task("one", "approved"));
		yield* client("fleet.prepare", {
			cwd: "/synthetic-repository",
			preparation: prepared({ ownedPaths: ["src/one.ts"] }),
			prompt: "Implement the approved changes",
			workId: "one",
		});
		yield* client("fleet.dispatch", { workId: "one" });
		finishWorker(yield* started(client, "worker"));
		yield* until(() => client("fleet.reconcile", { workId: "one" }).pipe(Effect.map((record) => record.decision?.code === "reviewed-pr-ready")));
		return yield* client("fleet.get", { workId: "one" });
	});
	function answer(record: FleetRecord, body: string, author = "maintainer") {
		const decision = record.decision;
		if (decision?.published === undefined) {
			throw new Error("Missing ready-to-merge decision");
		}
		responses += 1;
		const responseId = `synthetic.answer.${responses}`;
		writeFileSync(
			join(fixture.host.boardDir, "responses", `${responseId}.md`),
			responseMarkdown({
				body,
				id: responseId,
				response: {
					answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
					author,
					question: decision.published.questionId,
					recordedAt: 100 + responses,
					reviewedRevision: decision.published.revision,
					type: "answer",
				},
			}),
		);
		return { decisionId: decision.id, responseId, workId: "one" };
	}
	return {
		answer,
		configFile: fixture.configFile,
		finishWorker,
		github,
		host: fixture.host,
		PR,
		parts,
		provider: fixture.provider,
		ready,
		serve,
		started,
	};
}

export type ApprovedPrFixture = ReturnType<typeof approvedPrFixture>;

export function withApprovedPrDaemon<A, E>(use: (fixture: ReturnType<typeof approvedPrFixture>) => Effect.Effect<A, E>) {
	return Effect.scoped(
		Effect.gen(function* () {
			const github = yield* mergedReviewGithub();
			return yield* withHost({}, { intervalSeconds: 3600 }, (fixture) => use(approvedPrFixture(fixture, github)));
		}),
	);
}

export function repairAttempts(record: FleetRecord) {
	return record.attempts.filter((attempt) => attempt.role === "repair");
}

export function reviewHeads(record: FleetRecord) {
	return record.attempts.filter((attempt) => attempt.role === "reviewer").map((attempt) => attempt.reviewHead);
}
