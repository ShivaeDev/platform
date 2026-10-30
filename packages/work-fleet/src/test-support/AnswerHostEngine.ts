import { Context, Effect } from "effect";
import type { SqlClient } from "effect/sql";
import { fleetHealth } from "@shivaedev/work-board/server/diagnostics/fleetHealth.ts";
import { Fleet } from "#fleet.ts";
import type { HostSettings } from "#host/config.ts";
import { daemonLayer } from "#host/daemon.ts";
import { type ApprovedPrFixture, approvedPrFixture, schedulerReady } from "#test/approvedPrDaemon.ts";
import { type HostFixture, hostFixture, task } from "#test/fleetHost.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { resolutionHold } from "#test/resolutionHold.ts";
import { spanCounts } from "#test/spanCounts.ts";
import { type HostDaemon, startHostDaemon } from "#test/startHostDaemon.ts";

export class AnswerHostEngine {
	files: Record<string, string> = { "one.md": task("one", "approved") };
	config: Partial<HostSettings> = {};
	approvedPr = false;
	scheduled = true;
	boardOverride: HostFixture["parts"]["board"];
	beforeStart: Effect.Effect<void, unknown, SqlClient.SqlClient> = Effect.void;
	readonly resolution = resolutionHold();
	readonly spans = spanCounts();
	#fixture: HostFixture | undefined;
	#pr: ApprovedPrFixture | undefined;
	#runtime: HostDaemon | undefined;

	get host() {
		if (this.#fixture === undefined) {
			throw new Error("The host has not been created");
		}
		return this.#fixture;
	}

	get pullRequest() {
		if (this.#pr === undefined) {
			throw new Error("The host has no approved PR fixture");
		}
		return this.#pr;
	}

	get running() {
		if (this.#runtime === undefined) {
			throw new Error("The daemon is stopped");
		}
		return this.#runtime;
	}

	deploy() {
		const engine = this;
		return Effect.gen(function* () {
			engine.#fixture = yield* hostFixture(engine.files, engine.config);
			if (engine.approvedPr) {
				engine.#pr = approvedPrFixture(engine.#fixture, yield* mergedReviewGithub());
			}
			yield* engine.beforeStart;
			yield* engine.start();
		});
	}

	start() {
		const engine = this;
		return engine.spans.trace(
			Effect.gen(function* () {
				if (engine.#runtime !== undefined) {
					return yield* Effect.die("The daemon is already running");
				}
				const { host } = engine.host;
				const scheduled = engine.#pr !== undefined && engine.scheduled;
				const previous = scheduled ? yield* fleetHealth(host.boardDir).pipe(Effect.option) : undefined;
				const effectiveParts = engine.#parts();
				const layer = scheduled ? daemonLayer(host, effectiveParts, 0) : readDaemonLayer(host, { parts: effectiveParts });
				engine.#runtime = yield* startHostDaemon(layer);
				if (previous !== undefined) {
					yield* schedulerReady(host.boardDir, previous._tag === "Some" ? previous.value.lastSchedulerPass : null);
				}
			}),
		);
	}

	#parts() {
		if (this.#pr !== undefined) {
			return this.#pr.parts;
		}
		const original = this.host.parts;
		const parts = this.boardOverride === undefined ? original : { ...original, board: this.boardOverride };
		return parts.board === undefined ? parts : { ...parts, board: this.resolution.board(parts.board) };
	}

	stop() {
		const engine = this;
		return Effect.gen(function* () {
			yield* engine.running.stop;
			engine.#runtime = undefined;
		});
	}

	get fleet() {
		return Context.get(this.running.context, Fleet);
	}

	inspect() {
		return { providerTurns: this.#fixture?.provider.observations.size, running: this.#runtime?.port };
	}
}
