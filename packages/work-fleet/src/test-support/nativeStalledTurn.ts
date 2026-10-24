import { Context, Layer } from "effect";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration } from "#test/codex.ts";
import { engine } from "#test/engineStory.ts";
import { stalledCodex } from "#test/stalledCodex.ts";

export function nativeStalledTurn(delayInterrupt = false) {
	return engine.trait("configuration", "Codex runs a turn whose progress can stall", function* (state) {
		const server = yield* stalledCodex(delayInterrupt);
		state.recovery.native = server;
		state.now = 0;
		const services = yield* Layer.build(codexConfiguration(server.endpoint));
		const transport = Context.get(services, SessionTransport);
		state.options = { ...state.options, decorateTransport: () => transport };
	});
}
