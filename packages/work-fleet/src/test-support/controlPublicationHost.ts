import { Context, Effect, Exit, Layer, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { daemonHostOptions, daemonHttpLayer } from "#host/daemon.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { answerDelay } from "#test/answerDelay.ts";
import { hostFixture, task } from "#test/fleetHost.ts";

export const controlPublicationHost = Effect.fn("ControlPublicationTest.controlPublicationHost")(function* () {
	const fixture = yield* hostFixture({ "one.md": task("one", "approved"), "two.md": task("two", "approved") });
	const archive = yield* answerDelay(fixture, "archive");
	const options = daemonHostOptions(fixture.host, archive.parts, 0);
	const daemonScope = yield* Scope.make();
	const close = Scope.close(daemonScope, Exit.void);
	yield* Effect.addFinalizer(() => close);
	const context = yield* Layer.buildWithScope(daemonHttpLayer(options), daemonScope);
	yield* Effect.addFinalizer(() => archive.release);
	const address = Context.get(context, HttpServer.HttpServer).address;
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected a TCP daemon");
	}
	return { archive, client: yield* daemonClient(address.port), close, context, fixture, port: address.port };
});
