import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";

const switches = collection("reflected-switches", Schema.Number);

export const ReflectedSwitch = contract("switch", {
	commands: [command("set", { invalidates: () => [switches.item(1)], payload: { enabled: Schema.Boolean }, success: Schema.Void })],
	queries: [query("get", { readPolicy: () => Effect.succeed(true), reads: () => [switches.item(1)], success: Schema.Boolean })],
});
