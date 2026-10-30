import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { type Duration, Effect, Fiber } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { processes } from "@shivaedev/work-board/server/processOwnership.ts";
import { type SupervisorState, supervisionStatus } from "#host/supervisorState.ts";
import { launchSupervisorCli } from "#test/launchSupervisorCli.ts";
import { supervisorInstallation } from "#test/supervisorInstallation.ts";

export class SupervisorStoryEngine {
	installation: Effect.Success<ReturnType<typeof supervisorInstallation>> | undefined;
	process: Effect.Success<ReturnType<typeof launchSupervisorCli>> | undefined;
	stalePid: number | undefined;
	delayedLive = false;
	stubbornChild: "daemon" | "board" | undefined;
	pending: Fiber.Fiber<{ readonly body: string; readonly status: number }, unknown> | undefined;

	get fixture() {
		if (this.installation === undefined) {
			throw new Error("Deploy the consumer fixture first");
		}
		return this.installation;
	}

	deploy = Effect.fn("SupervisorStory.deploy")(function* (this: SupervisorStoryEngine) {
		this.installation = yield* supervisorInstallation(this.delayedLive, this.stubbornChild);
	});

	start = Effect.fn("SupervisorStory.start")(function* (this: SupervisorStoryEngine) {
		this.process = yield* launchSupervisorCli(
			this.fixture.cli,
			["up", this.fixture.boardDir, "--port", "0", "--board-port", "0", "--home", "home.md", "--responses", "--maintainer", "operator"],
			this.fixture.root,
		);
	});

	run(args: readonly string[], entry = this.fixture.cli) {
		return Effect.scoped(launchSupervisorCli(entry, args, this.fixture.root).pipe(Effect.flatMap((child) => child.done)));
	}

	state() {
		return supervisionStatus(this.fixture.boardDir);
	}

	until(condition: () => Effect.Effect<boolean, unknown>, timeout: Duration.Input = "30 seconds") {
		const engine = this;
		return Effect.gen(function* () {
			while (!(yield* condition())) {
				if (engine.process !== undefined && !engine.process.running()) {
					throw new Error(`Supervisor exited: ${engine.process.output()}`);
				}
				yield* Effect.sleep("100 millis");
			}
		}).pipe(
			Effect.timeout(timeout),
			Effect.tapError(() => Effect.logError(this.inspect())),
		);
	}

	ready(name: "daemon" | "board", previousPid?: number | null) {
		const engine = this;
		return this.until(
			() =>
				Effect.gen(function* () {
					const state = yield* engine.state().pipe(Effect.orElseSucceed(() => undefined));
					if (state === undefined || state[name].pid === null || state[name].pid === previousPid) {
						return false;
					}
					return yield* engine.http(state, name).pipe(
						Effect.map(({ status }) => status >= HttpStatus.fromLiteral("OK") && status < HttpStatus.fromLiteral("MultipleChoices")),
						Effect.orElseSucceed(() => false),
					);
				}),
			"60 seconds",
		);
	}

	http(state: SupervisorState, name: "daemon" | "board", path = name === "daemon" ? "/live" : "/") {
		return Effect.tryPromise(async () => {
			const response = await fetch(`http://127.0.0.1:${state[name].port}${path}`);
			return { body: await response.text(), status: response.status };
		});
	}

	awaitRevision(previous: string) {
		const engine = this;
		return this.until(() =>
			Effect.gen(function* () {
				const state = yield* engine.state();
				if (state === undefined || state.daemon.revision === previous || state.daemon.pid === null) {
					return false;
				}
				return yield* engine.http(state, "daemon").pipe(
					Effect.map(({ status }) => status >= HttpStatus.fromLiteral("OK") && status < HttpStatus.fromLiteral("MultipleChoices")),
					Effect.orElseSucceed(() => false),
				);
			}),
		);
	}

	beginRequest = Effect.fn("SupervisorStory.beginRequest")(function* (this: SupervisorStoryEngine) {
		const state = yield* this.state();
		if (state === undefined) {
			throw new Error("Start supervision first");
		}
		const offset = this.log().length;
		this.pending = yield* Effect.forkScoped(this.http(state, "daemon", "/live?slow"));
		yield* this.until(() => Effect.sync(() => this.log().slice(offset).includes("slow live request started")));
	});

	finishRequest() {
		if (this.pending === undefined) {
			throw new Error("Begin a request first");
		}
		return Fiber.join(this.pending);
	}

	leaveStaleLock = Effect.fn("SupervisorStory.leaveStaleLock")(function* (this: SupervisorStoryEngine) {
		const dead = spawnSync(process.execPath, ["-e", ""]);
		if (dead.pid === undefined) {
			throw new Error("Expected a dead fixture process");
		}
		this.stalePid = dead.pid;
		writeFileSync(join(this.fixture.boardDir, ".work-up.json"), JSON.stringify({ ...(yield* processes.currentInstance("up")), pid: dead.pid }));
	});

	log() {
		const file = join(this.fixture.boardDir, ".work-up.log");
		return existsSync(file) ? readFileSync(file, "utf8") : "";
	}

	inspect() {
		return { log: this.log(), output: this.process?.output() };
	}
}
