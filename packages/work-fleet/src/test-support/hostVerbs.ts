import { Effect } from "effect";
import { withBoardReadPass } from "#board/readPass.ts";
import { cycle } from "#engine/scheduler.ts";
import { admitApproved, dispatchApproved } from "#host/admission.ts";
import { daemonRequest } from "#host/daemonClient.ts";
import type { MainSnapshot } from "#host/mainSource.ts";
import { answerAndWait, appliedAnswer, dispatchAndWait, waitForRecord } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { hostBoardVerbs } from "#test/hostBoardVerbs.ts";
import { hostFollowerVerbs } from "#test/hostFollowerVerbs.ts";
import { hostProviderVerbs } from "#test/hostProviderVerbs.ts";
import { hostStoreVerbs } from "#test/hostStoreVerbs.ts";

export function hostVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		...hostBoardVerbs(engine, tell),
		...hostFollowerVerbs(engine, tell),
		...hostProviderVerbs(engine, tell),
		...hostStoreVerbs(engine, tell),
		admit: () => {
			tell("admit approved Board work");
			return admitApproved(engine.fixture.host).pipe(Effect.provideContext(engine.running.context));
		},
		answer: (workId: string, text?: string, release = false) => {
			tell(`answer ${workId} through the daemon`);
			return answerAndWait(engine.running.client, { release, ...(text === undefined ? {} : { text }), workId });
		},
		appliedAnswer: (workId: string) => appliedAnswer(engine.running.client, workId),
		approve: (workId: string) => {
			tell(`explicitly dispatch the approved brief for ${workId}`);
			return dispatchApproved(engine.fixture.host, workId).pipe(Effect.provideContext(engine.running.context));
		},
		briefParseCount: () => {
			if (engine.briefParseCount === undefined) {
				throw new Error("Count brief parses before reading them");
			}
			return engine.briefParseCount();
		},
		cli: (args: readonly string[], options: { readonly stdin?: string; readonly selection?: "board" | "port" } = {}) => {
			tell(`run work-fleet ${args.join(" ")}`);
			return Effect.promise(async () => {
				let stderr = "";
				const selection = options.selection === "port" ? ["--port", String(engine.running.port)] : ["--board", engine.fixture.host.boardDir];
				const result = await cliProcess([...args, ...selection], {
					onError: (text) => {
						stderr += text;
					},
					...(options.stdin === undefined ? {} : { stdin: options.stdin }),
				});
				return { ...result, stderr: stderr.trim() };
			});
		},
		dispatch: (workId: string) => {
			tell(`dispatch ${workId} through the daemon`);
			return dispatchAndWait(engine.running.client, workId);
		},
		fleetDispatch: (workId: string) => {
			tell(`launch prepared work ${workId}`);
			return engine.fleet.dispatch(workId);
		},
		get: (workId: string) => engine.running.client("fleet.get", { workId }),
		moveMain: (snapshot: MainSnapshot) => {
			if (engine.main === undefined) {
				throw new Error("Configure moving main before changing its observation");
			}
			tell(`main moves to ${snapshot.revision}`);
			engine.main = snapshot;
		},
		port: () => engine.running.port,
		reconcile: (workId: string) => {
			tell(`reconcile ${workId} through the daemon`);
			return engine.running.client("fleet.reconcile", { workId });
		},
		requestStatus: (workId?: string) => {
			tell(`request ${workId === undefined ? "the overview" : workId} with the CLI timeout`);
			return daemonRequest(engine.running.port, (client) => client("daemon.status", workId === undefined ? {} : { workId }), "status");
		},
		resolve: (workId: string, decisionId: string, responseId: string) => {
			tell(`resolve ${workId}'s decision ${decisionId}`);
			return engine.running.client("fleet.resolve", { decisionId, responseId, workId });
		},
		schedule: () => {
			tell("run one host scheduler cycle");
			return cycle.pipe(Effect.provideContext(engine.running.context));
		},
		schedulerPass: () => {
			tell("admit and schedule one Board read pass");
			return withBoardReadPass(admitApproved(engine.fixture.host).pipe(Effect.andThen(cycle))).pipe(Effect.provideContext(engine.running.context));
		},
		start: (port = 0) => {
			tell(`start the daemon on ${port}`);
			return engine.start(port);
		},
		status: () => engine.running.client("daemon.status", {}),
		stop: () => {
			tell("stop the daemon");
			return engine.stop();
		},
		waitForRecord: (workId: string, ready: Parameters<typeof waitForRecord>[2]) => waitForRecord(engine.running.client, workId, ready),
	};
}
