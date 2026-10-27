import { expect } from "vitest";
import { developmentApp } from "#test/developmentApp.ts";

developmentApp.it(
	"starts app processes with their conditions and stops them when Vite exits",
	[],
	function* ({ start, started, finishVite, exitCode: readExitCode, remaining }) {
		yield* start();
		expect(started()).toMatchObject({ server: "application", worker: "application" });
		yield* finishVite();
		const exitCode = yield* readExitCode();
		expect(exitCode).toBe(7);
		expect(remaining()).toEqual([]);
	},
);
