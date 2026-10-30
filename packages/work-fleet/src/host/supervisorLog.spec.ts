import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { supervisorLog } from "#test/supervisorLog.ts";

supervisorLog.it("rotation retains the latest three older logs in order and drops the oldest", [], function* (log) {
	const padding = "x".repeat(3 * 1024 * 1024);
	const messages = {
		fifth: `fifth: ${padding}\n`,
		first: `first: ${padding}\n`,
		fourth: `fourth: ${padding}\n`,
		second: `second: ${padding}\n`,
		third: `third: ${padding}\n`,
	};
	for (const message of [messages.first, messages.second, messages.third, messages.fourth, messages.fifth]) {
		yield* log.append(message);
	}

	yield* outcomes({
		"current log": [log.read(), messages.fifth],
		"newest backup": [log.read(".1"), messages.fourth],
		"next backup": [log.read(".2"), messages.third],
		"oldest backup": [log.read(".3"), messages.second],
		"retained files": [log.files(), [".work-up.log", ".work-up.log.1", ".work-up.log.2", ".work-up.log.3"]],
	});
});

supervisorLog.it("an oversized existing log rotates before the next supervisor message", [], function* (log) {
	const previous = "old output\n".repeat(600_000);
	yield* log.seed(previous);

	yield* log.supervisor("Fleet is running");

	yield* outcomes({
		"new supervisor message": [log.read(), expect.stringMatching(/^\S+ supervisor: Fleet is running\n$/u)],
		"previous output": [log.read(".1"), previous],
	});
});

supervisorLog.it("concurrent writers preserve every message across rotation", [], function* (log) {
	const previous = "x".repeat(5 * 1024 * 1024 - 10);
	yield* log.seed(previous);
	const messages = ["daemon: dispatching work\n", "board: serving requests\n"];

	yield* Effect.all(messages.map(log.append), { concurrency: "unbounded" });

	yield* outcomes({
		"both writers": [log.read(), messages.join("")],
		"previous output": [log.read(".1"), previous],
	});
});

supervisorLog.it("rotation counts UTF-8 bytes at the size boundary", [], function* (log) {
	const previous = "é".repeat((5 * 1024 * 1024) / 2 - 1);
	yield* log.seed(previous);
	yield* log.append("é");
	expect(yield* log.read()).toBe(`${previous}é`);

	yield* log.append("next\n");

	yield* outcomes({
		"full previous output": [log.read(".1"), `${previous}é`],
		"next output": [log.read(), "next\n"],
	});
});
