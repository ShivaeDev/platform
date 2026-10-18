import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { appliedAnswer, dispatchAndWait } from "#test/daemonActions.ts";
import { discoveryDaemon } from "#test/discoveryDaemon.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { hostFixture, task } from "#test/fleetHost.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";

interface Selection {
	readonly board?: string;
	readonly port?: number;
}

function run(args: readonly string[] | string, stdin = "") {
	return Effect.promise(async () => {
		let stderr = "";
		const result = await cliProcess(args, {
			onError: (text) => {
				stderr += text;
			},
			stdin,
		});
		return { ...result, stderr };
	});
}

export const fleetAnswerHint = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const fixture = yield* hostFixture({ "one.md": task("one", "approved") }, {}, "fleet hint's board-");
		return { daemon: yield* discoveryDaemon(fixture), fixture };
	},
	inspect: (engine) => ({ board: engine.fixture.host.boardDir, port: engine.daemon.port }),
	layer: postgresLayer,
	name: "Fleet answer hint",
	runIf: postgresEnabled,
	stages: ["daemon"],
	verbs: (engine, story) => ({
		answer: (hint: string, text: string) => {
			if (!hint.startsWith("work-fleet answer ")) {
				throw new Error("Status did not print an answer command");
			}
			story.tell(`execute the printed command: ${hint}`);
			return run(hint, text);
		},
		appliedAnswer: () => Effect.flatMap(daemonClient(engine.daemon.port), (client) => appliedAnswer(client, "one")),
		board: () => engine.fixture.host.boardDir,
		dispatch: () => Effect.flatMap(daemonClient(engine.daemon.port), (client) => dispatchAndWait(client, "one")),
		port: () => engine.daemon.port,
		question: (text: string) =>
			Effect.gen(function* () {
				story.tell("complete the worker output with a question");
				const client = yield* daemonClient(engine.daemon.port);
				const record = yield* client("fleet.get", { workId: "one" });
				const turnId = record.attempts.at(-1)?.receipt?.turnId;
				const observation = turnId === undefined ? undefined : engine.fixture.provider.observations.get(turnId);
				if (turnId === undefined || observation === undefined) {
					return yield* Effect.die("Dispatch a worker before asking a question");
				}
				engine.fixture.provider.observations.set(turnId, { ...observation, execution: "completed", output: `FLEET_QUESTION: ${text}` });
			}),
		reconcile: () => {
			story.tell("reconcile the worker");
			return Effect.flatMap(daemonClient(engine.daemon.port), (client) => client("fleet.reconcile", { workId: "one" }));
		},
		status: (selection: Selection) =>
			run([
				"status",
				...(selection.board === undefined ? [] : ["--board", selection.board]),
				...(selection.port === undefined ? [] : ["--port", String(selection.port)]),
			]),
	}),
});

export function staleBoardPort() {
	return fleetAnswerHint.trait("daemon", "the Board port file names a stopped daemon", (engine) =>
		Effect.gen(function* () {
			const previous = engine.daemon.port;
			yield* engine.daemon.close;
			engine.daemon = yield* discoveryDaemon(engine.fixture);
			if (engine.daemon.port === previous) {
				return yield* Effect.die("Override stories require a different daemon port after restart");
			}
			engine.fixture.write(".fleet-port", `${previous}\n`);
		}),
	);
}
