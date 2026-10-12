import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcTest } from "effect/unstable/rpc";
import type { ReactNode } from "react";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { render } from "@shivaedev/effect-react/testing.ts";
import { workContract, workRpcs } from "#rpc/contract.ts";
import { BoardFixture } from "./BoardFixture.tsx";
import { type BoardFixtureOptions, inMemoryBoard } from "./inMemoryBoard.ts";

function boardClient(files: Readonly<Record<string, string>>, options?: BoardFixtureOptions) {
	class Client extends AtomRpc.Service<Client>()("WorkBoard/RenderTest", {
		group: workRpcs,
		makeEffect: RpcTest.makeClient(workRpcs, { flatten: true }),
		protocol: inMemoryBoard(files, options),
	}) {}
	return bind(workContract, Client);
}

export type BoardTestApi = ReturnType<typeof boardClient>;
type BoardRender = (api: BoardTestApi, registry: AtomRegistry.AtomRegistry) => ReactNode;

export function renderBoard(files: Readonly<Record<string, string>>, component: BoardRender, options?: BoardFixtureOptions) {
	const api = boardClient(files, options);
	return render(<BoardFixture create={(registry) => component(api, registry)} />);
}
