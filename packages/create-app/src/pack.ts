import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Path } from "effect";
import { packTemplate } from "#packTemplate.ts";

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const path = yield* Path.Path;
			yield* packTemplate(
				yield* path.fromFileUrl(new URL("../../../examples/starter", import.meta.url)),
				yield* path.fromFileUrl(new URL("../template.json", import.meta.url)),
			);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}
