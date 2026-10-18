import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import type { ReactNode } from "react";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { render } from "@shivaedev/effect-react/client/testing.ts";
import type { Reader } from "#client/client.ts";
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
	return Object.assign(bind(workContract, Client), {
		forms: { handoffs: bind(handoffContract, Client), responses: bind(responseContract, Client), runtime: Client.runtime },
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
