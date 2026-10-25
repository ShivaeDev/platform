import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { Fleet, type PrepareWork } from "#fleet.ts";
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
		boardInboxFiles: (audience?: Parameters<typeof boardAskFiles>[1]) => {
			if (state.root === "") {
				throw new Error("No Markdown Board is configured");
			}
			tell("read Board inbox files over HTTP");
			return boardAskFiles(state.root, audience);
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
		rpcContinue: (input: { workId: string; message: string }) =>
			Effect.gen(function* () {
				tell(`continue ${input.workId} through native RPC`);
				return yield* (yield* rpcClient())("fleet.continue", input);
			}).pipe(Effect.scoped),
		rpcDispatch: (workId: string) =>
			Effect.gen(function* () {
				tell(`dispatch ${workId} through native RPC`);
				return yield* (yield* rpcClient())("fleet.dispatch", { workId });
			}).pipe(Effect.scoped),
		rpcGet: (workId: string) =>
			Effect.gen(function* () {
				tell(`read ${workId} through native RPC`);
				return yield* (yield* rpcClient())("fleet.get", { workId });
			}).pipe(Effect.scoped),
		rpcPrepare: (input: PrepareWork) =>
			Effect.gen(function* () {
				tell(`prepare ${input.workId} through native RPC`);
				return yield* (yield* rpcClient())("fleet.prepare", input);
			}).pipe(Effect.scoped),
		rpcReassign: (input: { workId: string; decisionId: string; attentionOwner: "maintainer" | "orchestrator" }) =>
			Effect.gen(function* () {
				tell(`reassign ${input.workId} through native RPC`);
				return yield* (yield* rpcClient())("fleet.reassign", input);
			}).pipe(Effect.scoped),
		rpcReconcile: (workId: string) =>
			Effect.gen(function* () {
				tell(`reconcile ${workId} through native RPC`);
				return yield* (yield* rpcClient())("fleet.reconcile", { workId });
			}).pipe(Effect.scoped),
		rpcReconcileRequest: (input: { workId: string }) =>
			Effect.gen(function* () {
				tell(`reconcile ${input.workId} through native RPC`);
				return yield* (yield* rpcClient())("fleet.reconcile", input);
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
