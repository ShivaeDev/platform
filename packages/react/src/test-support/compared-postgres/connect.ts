import type { Layer } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as Socket from "effect/socket/Socket";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Api } from "#test/compared-postgres/feature.ts";

export function connect(url: string, webSocketConstructor: Layer.Layer<Socket.WebSocketConstructor>, live: boolean, runtime: Atom.RuntimeFactory) {
	return makeClient(Api, { live, runtime, url, webSocketConstructor });
}
