import { Option } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import type { ReactNode } from "react";
import { bind } from "@shivaedev/contract/bind.ts";
import { render } from "@shivaedev/react/client/testing.ts";
import type { BrowserClient, Reader } from "#browserClient.ts";
import { FormContext } from "#client/react/FormContext.ts";
import { workContract, workRpcs } from "#rpc/contract.ts";
import { handoffContract } from "#rpc/handoffContract.ts";
import { responseContract } from "#rpc/responseContract.ts";
import { BoardFixture } from "./BoardFixture.tsx";
import { type BoardFixtureOptions, inMemoryBoard } from "./inMemoryBoard.ts";

function boardClient(files: Readonly<Record<string, string>>, options?: BoardFixtureOptions) {
	class Client extends AtomRpc.Service<Reader>()("WorkBoard/RenderTest", {
		group: workRpcs,
		makeEffect: RpcTest.makeClient(workRpcs, { flatten: true }),
		protocol: inMemoryBoard(files, options),
	}) {}
	const live: Atom.Type<BrowserClient["updates"]["status"]> = { connection: "live", failure: Option.none(), needsResync: false, pending: 0 };
	const status: BrowserClient["updates"]["status"] = Atom.make(live).pipe(Atom.keepAlive);
	return Object.assign(bind(workContract, Client, { live: false }), {
		forms: {
			handoffs: bind(handoffContract, Client, { live: false }),
			responses: bind(responseContract, Client, { live: false }),
			runtime: Client.runtime,
			updates: { status },
		},
	});
}

export type BoardTestApi = ReturnType<typeof boardClient>;
type BoardRender = (api: BoardTestApi, registry: AtomRegistry.AtomRegistry) => ReactNode;

export async function renderBoard(files: Readonly<Record<string, string>>, component: BoardRender, options?: BoardFixtureOptions) {
	const api = boardClient(files, options);
	const view = await render(
		<FormContext.Provider value={api.forms}>
			<BoardFixture create={(registry) => component(api, registry)} />
		</FormContext.Provider>,
	);
	return {
		...view,
		forms: api.forms,
		render: (node: ReactNode) => view.render(<FormContext.Provider value={api.forms}>{node}</FormContext.Provider>),
	};
}
