import { Context, Effect, Exit, Layer, Scope } from "effect";
import { HttpServer } from "effect/http";
import { fleetHealth } from "@shivaedev/work-board/diagnostics/fleetHealth.ts";
import { Fleet } from "#fleet.ts";
import type { HostConfig } from "#host/config.ts";
import { daemonLayer } from "#host/daemon.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { type ApprovedPrFixture, approvedPrFixture, schedulerReady } from "#test/approvedPrDaemon.ts";
import { type HostFixture, hostFixture, task } from "#test/fleetHost.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { spanCounts } from "#test/spanCounts.ts";

interface Runtime {
	readonly client: Effect.Success<ReturnType<typeof daemonClient>>;
	readonly context: Context.Context<Layer.Success<ReturnType<typeof readDaemonLayer>>>;
	readonly port: number;
	readonly stop: Effect.Effect<void>;
}

export class AnswerHostEngine {
	files: Record<string, string> = { "one.md": task("one", "approved") };
	config: Partial<HostConfig> = {};
	approvedPr = false;
	readonly spans = spanCounts();
	#fixture: HostFixture | undefined;
	#pr: ApprovedPrFixture | undefined;
	#runtime: Runtime | undefined;

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
				const scope = yield* Scope.make();
				yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
				const { host, parts } = engine.host;
				const previous = engine.#pr === undefined ? undefined : yield* fleetHealth(host.boardDir).pipe(Effect.option);
				const layer = engine.#pr === undefined ? readDaemonLayer(host, { parts }) : daemonLayer(host, engine.#pr.parts, 0);
				const context = yield* Layer.buildWithScope(Layer.fresh(layer), scope);
				const url = HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address);
				const port = Number(new URL(url).port);
				engine.#runtime = { client: yield* daemonClient(port), context, port, stop: Scope.close(scope, Exit.void) };
				if (previous !== undefined) {
					yield* schedulerReady(host.boardDir, previous._tag === "Some" ? previous.value.lastSchedulerPass : null);
				}
			}),
		);
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
