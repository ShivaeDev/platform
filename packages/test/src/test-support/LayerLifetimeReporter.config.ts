import { readFileSync } from "node:fs";
import process from "node:process";
import { Config, Effect } from "effect";
import type { Reporter } from "vitest/node";

export default class LayerLifetimeReporter implements Reporter {
	async onTestModuleEnd() {
		const path = Effect.runSync(Config.String("EFFECT_TEST_SERVER_URL"));
		const url = readFileSync(path, "utf8");
		const result = await fetch(url).then(
			(response) => response.text(),
			(error: Error) => (error.cause instanceof Error && "code" in error.cause ? String(error.cause.code) : error.message),
		);
		process.stdout.write(`Layer at file completion: ${result}\n`);
	}
}
