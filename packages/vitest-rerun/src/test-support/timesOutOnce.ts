import { fileURLToPath } from "node:url";
import { rerunStory } from "./kit.ts";
import { perAttempt } from "./specFiles.ts";
import { writeFile } from "./suite.ts";

const vitest = JSON.stringify(fileURLToPath(import.meta.resolve("vitest")));
const browser = JSON.stringify(fileURLToPath(import.meta.resolve("vitest/internal/browser")));

export function timesOutOnce() {
	return rerunStory.trait(
		"tests",
		'in timeout.spec.ts, "recovers after a timeout" times out after 50ms on its first attempt and passes on rerun',
		(suite) =>
			writeFile(
				suite,
				"timeout.spec.ts",
				perAttempt(`
import { mock } from 'node:test';
import { afterAll } from ${vitest};
import { getSafeTimers, setSafeTimers } from ${browser};

const { setTimeout, clearTimeout } = getSafeTimers();
mock.timers.enable({ apis: ['setTimeout'] });
setSafeTimers();
// Vitest's deadline uses the controlled timer; process I/O keeps its native timers.
Object.assign(globalThis, { setTimeout, clearTimeout });
afterAll(() => {
	mock.timers.reset();
	setSafeTimers();
});

it('recovers after a timeout', async () => {
	if (attempt === 1) {
		mock.timers.tick(50);
		await new Promise(() => {});
	}
}, 50);
`),
			),
	);
}
