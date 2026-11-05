import { Random } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { defineService } from "@shivaedev/service/defineService.ts";
import { LiveDispatcher } from "#adapters/LiveDispatcher.ts";
import { initialize } from "./initialize.ts";
import { register } from "./register.ts";
import { resync } from "./resync.ts";
import { stream } from "./stream.ts";

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
