import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import type { ReactNode } from "react";
import { FleetItemsContext } from "#client/react/FleetItemsContext.ts";
import { GoalsPage } from "#client/react/GoalsPage.tsx";
import { LazyChunksContext } from "#client/react/lazyChunks.ts";
import { SystemPage } from "#client/react/SystemPage.tsx";
import { shellIds } from "#client/react/shellIds.ts";
import { workRpcs } from "#rpc/contract.ts";
import { goalsFixture } from "./goalsFixture.ts";
import { PageHealth } from "./PageHealth.tsx";
import type { BoardTestApi } from "./react.tsx";
import type { ScreenEngine } from "./screenEngine.ts";
import { workspaceBoard } from "./workspaceBoard.ts";

export function screenContent(engine: ScreenEngine, content: ReactNode) {
	let visible = content;
	if (engine.health && engine.api) {
		visible = (
			<>
				{visible}
				<PageHealth api={engine.api} />
			</>
		);
	}
	return (
		<LazyChunksContext.Provider value={engine.chunks}>
			{engine.fleet ? <FleetItemsContext.Provider value={engine.fleet}>{visible}</FleetItemsContext.Provider> : visible}
		</LazyChunksContext.Provider>
	);
}
export function screenClient(engine: ScreenEngine, api: BoardTestApi) {
	engine.api = api;
}
export function* goalsContent(files = goalsFixture()) {
	const data = yield* Effect.scoped(
		Effect.flatMap(RpcTest.makeClient(workRpcs, { flatten: true }), (client) => client("work-board.goals", undefined)),
	).pipe(Effect.provide(workspaceBoard(files, { home: undefined })));
	return <GoalsPage data={data} />;
}
export function systemContent(fleet: ScreenEngine["fleet"]) {
	const missing = { cause: "Source missing", observedAt: 0, state: "not-configured" } as const;
	return (
		<FleetItemsContext.Provider value={fleet}>
			<SystemPage data={{ now: 0, sources: { codex: missing, fleet: missing, github: missing } }} />
		</FleetItemsContext.Provider>
	);
}

export function readingContent(kind: string) {
	return (
		<>
			<aside id={shellIds.sidebar} />
			<main id={shellIds.doc}>
				<p>Reviewed context</p>
				<form id={`${kind}-form`}>
					<textarea defaultValue="Direction in progress" name="body" />
				</form>
			</main>
		</>
	);
}
