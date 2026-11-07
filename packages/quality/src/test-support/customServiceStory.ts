import { rmSync } from "node:fs";
import { ConfigProvider, Console, Effect, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { lint } from "#cli/lint.ts";
import { services } from "#cli/runMain.ts";
import { LineAllowance } from "#test/customServiceRule.ts";
import { capturing, type Output } from "#testing/adapters/cli.ts";
import { isolatedEnvironment } from "#testing/adapters/git.ts";
import { qualityTree } from "#testing/adapters/qualityTree.ts";

const RULE_URL = new URL("./customServiceRule.ts", import.meta.url).href;

export const customServiceStory = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync(() => ({
				output: { stderr: "", stdout: "" } satisfies Output,
				root: qualityTree([
					{
						content: [
							'import { defineConfig } from "@shivaedev/quality/config.ts";',
							`import { customServiceRule } from ${JSON.stringify(RULE_URL)};`,
							'export default defineConfig({ local: [customServiceRule], rules: { "local/line-limit": { options: { max: "1" } } }, sources: ["src"] });',
						].join("\n"),
						path: "quality.config.ts",
					},
					{ content: "export function value(): number {\n\treturn 1;\n}\n", path: "src/value.ts" },
				]),
			})),
			({ root }) => Effect.sync(() => rmSync(root, { force: true, recursive: true })),
		),
	inspect: ({ output }) => output,
	layer: Layer.merge(services, Layer.succeed(LineAllowance, 1)),
	name: "Quality custom service",
	stages: [],
	verbs: (engine, story) => ({
		checks: () => {
			story.tell("quality lint runs the configured rule with the supplied line allowance");
			return lint(engine.root, undefined).pipe(
				Effect.provide(
					ConfigProvider.layerAdd(ConfigProvider.fromEnv({ env: { "HEAVY_PROCESS_LOCK": isolatedEnvironment(engine.root).HEAVY_PROCESS_LOCK } }), {
						asPrimary: true,
					}),
				),
				Effect.provideService(Console.Console, capturing(engine.output)),
				Effect.catchTag("GateFailed", () => Effect.void),
			);
		},
		report: () => Effect.sync(() => engine.output.stdout),
	}),
});
