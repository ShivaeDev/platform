import { fileURLToPath } from "node:url";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { packTemplate } from "./packTemplate.ts";

if (import.meta.main) {
	NodeRuntime.runMain(
		packTemplate(
			fileURLToPath(new URL("../../../examples/starter", import.meta.url)),
			fileURLToPath(new URL("../template.json", import.meta.url)),
		).pipe(Effect.provide(NodeServices.layer)),
	);
}
