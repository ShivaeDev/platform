import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { packTemplate } from "./packTemplate.ts";

NodeRuntime.runMain(
	packTemplate(
		fileURLToPath(new URL("../../../examples/starter", import.meta.url)),
		fileURLToPath(new URL("../template.json", import.meta.url)),
	).pipe(Effect.provide(NodeServices.layer)),
);
