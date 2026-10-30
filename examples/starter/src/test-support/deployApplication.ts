import { writeSync } from "node:fs";
import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { applicationHost } from "#server/applicationHost.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { runWorker } from "#server/runWorker.ts";
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
	runWorker(Layer.launch(applicationWorker({ poolSizes: testPoolSizes })));
}
