import * as Reactivity from "effect/reactivity/Reactivity";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { resync } from "#live-server/resync.ts";
import { stream } from "#live-server/stream.ts";
import { subscribe } from "#live-server/subscribe.ts";
import { makeLiveServer } from "#makeLiveServer.ts";

export const LiveServer = defineService({
	id: "@shivaedev/contract/LiveServer",
	initialize: makeLiveServer,
	methods: (server) => ({
		resync: resync(server),
		stream: stream(server),
		subscribe: genericMethod(subscribe(server)),
	}),
	requires: [Reactivity.Reactivity],
});
