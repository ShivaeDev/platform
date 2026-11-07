import { Random } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { LiveDispatcher } from "#adapters/LiveDispatcher.ts";
import { initialize } from "#live-server/initialize.ts";
import { register } from "#live-server/register.ts";
import { resync } from "#live-server/resync.ts";
import { stream } from "#live-server/stream.ts";

export const LiveServer = defineService({
	id: "@shivaedev/contract/LiveServer",
	initialize,
	methods: (state) => ({
		register: register(state),
		resync: resync(state),
		stream: stream(state),
	}),
	requires: [Reactivity.Reactivity, LiveDispatcher, Random.Random],
});
