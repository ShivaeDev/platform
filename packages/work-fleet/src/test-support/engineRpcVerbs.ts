import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { Fleet } from "#fleet.ts";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { boardAskFiles, boardHttp } from "#test/boardHttp.ts";
import { type EngineStory, running } from "#test/engineState.ts";

type BoardClient = Effect.Success<ReturnType<typeof boardHttp>>["client"];
type BoardAnswer = Parameters<BoardClient["responses"]["recordResponse"]["run"]>[0];

export function engineRpcVerbs(state: EngineStory, tell: (line: string) => void) {
	function board() {
		if (state.root === "") {
			throw new Error("No Markdown Board is configured");
		}
		return boardHttp(state.root);
	}
	function rpcClient() {
		return RpcTest.makeClient(FleetContract.application, { flatten: true }).pipe(
			Effect.provide(fleetHandlers),
			Effect.provideService(Fleet, running(state).fleet),
		);
	}
	return {
		boardInboxFiles: () => {
			if (state.root === "") {
				throw new Error("No Markdown Board is configured");
			}
			tell("read Board inbox files over HTTP");
			return boardAskFiles(state.root);
		},
		recordBoardResponse: (answer: BoardAnswer) =>
			Effect.gen(function* () {
				tell(`record Board response ${answer.id}`);
				const { client } = yield* board();
				return yield* Effect.tryPromise(() => client.mutate(client.responses.recordResponse.run(answer)));
			}),
		requestBoardPage: (path: string, redirect: "follow" | "manual" = "follow") =>
			Effect.gen(function* () {
				tell(`request Board page ${path}`);
				const { url } = yield* board();
				return yield* Effect.tryPromise(async () => {
					const response = await fetch(new URL(path, url), { redirect });
					return { location: response.headers.get("location"), status: response.status, text: await response.text() };
				});
			}),
		rpcReconcile: (workId: string) =>
			Effect.gen(function* () {
				tell(`reconcile ${workId} through native RPC`);
				return yield* (yield* rpcClient())("fleet.reconcile", { workId });
			}).pipe(Effect.scoped),
		rpcResolve: (input: { decisionId: string; responseId: string; workId: string }) =>
			Effect.gen(function* () {
				tell(`resolve ${input.workId} through native RPC`);
				return yield* (yield* rpcClient())("fleet.resolve", input);
			}).pipe(Effect.scoped),
		rpcViews: () =>
			Effect.gen(function* () {
				tell("read Fleet waiting groups through native RPC");
				return yield* (yield* rpcClient())("fleet.views", undefined);
			}).pipe(Effect.scoped),
	};
}
