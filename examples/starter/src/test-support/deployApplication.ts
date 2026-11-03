import { writeSync } from "node:fs";
import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Config, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { TestClock } from "effect/testing";
import { hostTime } from "@shivaedev/server/testing/hostTime.ts";
import { applicationHost } from "#server/applicationHost.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { runWorker } from "#server/runWorker.ts";
import { deploymentTime } from "./deploymentTime.ts";
import { testPoolSizes } from "./poolSizes.ts";

if (process.argv[2] === "web") {
	NodeRuntime.runMain(
		Layer.launch(
			applicationHost({ poolSizes: testPoolSizes }).pipe(
				Layer.tap((context) =>
					HttpServer.addressFormattedWith((address) => Effect.sync(() => writeSync(3, `${address}\n`))).pipe(Effect.provideContext(context)),
				),
			),
		),
	);
} else {
	runWorker(
		Effect.gen(function* () {
			yield* TestClock.setTime(yield* Config.Number("STORY_CLOCK_START"));
			const time = yield* hostTime();
			yield* deploymentTime(time);
			yield* Layer.launch(applicationWorker({ poolSizes: testPoolSizes }).pipe(Layer.provide(time.layer))).pipe(TestClock.withLive);
		}).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
	);
}
