import process from "node:process";
import { fileURLToPath } from "node:url";
import { Context, Effect, Layer, Logger } from "effect";
import { Backend } from "@shivaedev/agent/backend.ts";
import type { Receipt } from "@shivaedev/agent/run.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { codexLayer } from "#codex.ts";
import { CodexConfig } from "#config.ts";
export const localProcess = storyKit({
	create: () =>
		Effect.gen(function* () {
			const logs: unknown[] = [];
			const layer = codexLayer.pipe(
				Layer.provide(Layer.succeed(CodexConfig)({ args: [fileURLToPath(new URL("./stdioPeer.ts", import.meta.url))], command: process.execPath })),
				Layer.provide(
					Logger.layer([
						Logger.make(({ message }) => {
							logs.push(message);
						}),
					]),
				),
			);
			const context = yield* Layer.build(layer);
			const receipt: { value: Receipt | undefined } = { value: undefined };
			return { backend: Context.get(context, Backend), logs, receipt };
		}),
	name: "Codex stdio process",
	stages: ["process"],
	verbs: (state) => ({
		logs: () => Effect.sync(() => state.logs),
		start: () =>
			state.backend.start({ cwd: process.cwd(), input: { parts: [{ text: "hello", type: "text" }] }, operationId: "stdio-operation" }).pipe(
				Effect.tap((receipt) =>
					Effect.sync(() => {
						state.receipt.value = receipt;
					}),
				),
			),
		transcript: () =>
			Effect.gen(function* () {
				const feature = state.backend.features.transcript;
				if (feature.support !== "supported") {
					return yield* Effect.die(feature.reason);
				}
				if (state.receipt.value === undefined) {
					return yield* Effect.die("Start a run first");
				}
				return yield* feature.implementation.read(state.receipt.value);
			}),
	}),
});
