import { createServer } from "node:http";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { fakeHttpReceive } from "#server/adapters/fakeHttpReceive.ts";
import { loopbackServer } from "#server/adapters/loopback.ts";
import { fakeHttpControls } from "#server/fakeHttpControls.ts";
import type { FakeHttpRequestRecord, FakeHttpServiceOptions } from "#server/fakeHttpService.ts";
import { fakeHttpSignals } from "#server/fakeHttpSignals.ts";

export const fakeHttpRuntime = Effect.fnUntraced(function* (options: FakeHttpServiceOptions, tell: (line: string) => void) {
	const clock = yield* Clock.Clock;
	const requests: FakeHttpRequestRecord[] = [];
	const controls = fakeHttpControls(tell, () => clock.currentTimeMillisUnsafe());
	const signals = fakeHttpSignals();
	const server = createServer((request, response) => fakeHttpReceive(request, response, options, requests, controls, tell, signals.record));
	const url = yield* loopbackServer(server);
	yield* Effect.addFinalizer(() => Effect.sync(signals.close));
	yield* Effect.addFinalizer(controls.close);
	return { controls, requests, signals, url };
});
