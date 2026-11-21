import type { Layer } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as Socket from "effect/socket/Socket";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { Api } from "#test/compared-postgres/feature.ts";

export function connect(url: string, webSocketConstructor: Layer.Layer<Socket.WebSocketConstructor>, runtime: Atom.RuntimeFactory) {
	return makeClient({ api: Api }, { runtime, url, webSocketConstructor });
}
