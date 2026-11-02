import type { Layer } from "effect";
import type * as Socket from "effect/socket/Socket";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Api } from "./feature.ts";

export function connect(url: string, webSocketConstructor: Layer.Layer<Socket.WebSocketConstructor>, live = true) {
	return makeClient(Api, { live, url, webSocketConstructor });
}
