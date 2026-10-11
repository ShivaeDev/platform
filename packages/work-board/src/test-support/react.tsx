import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcTest } from "effect/unstable/rpc";
import type { ReactNode } from "react";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { render } from "@shivaedev/effect-react/testing.ts";
import { workContract, workRpcs } from "#rpc/contract.ts";
import { inMemoryBoard } from "./inMemoryBoard.ts";

function boardClient(files: Readonly<Record<string, string>>) {
	class Client extends AtomRpc.Service<Client>()("WorkBoard/RenderTest", {
		group: workRpcs,
		makeEffect: RpcTest.makeClient(workRpcs, { flatten: true }),
		protocol: inMemoryBoard(files),
	}) {}
	return bind(workContract, Client);
}

export type BoardTestApi = ReturnType<typeof boardClient>;

export function renderBoard(files: Readonly<Record<string, string>>, component: (api: BoardTestApi) => ReactNode) {
	return render(component(boardClient(files)));
}
