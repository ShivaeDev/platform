import { expect } from "vitest";
import { customTrim, trim } from "#test-support/trimStory.ts";

trim.it("the default shell checks every 30 seconds and trims every file above 250 MiB or after 15 minutes", [], ({ checkMemory }) => {
	const result = checkMemory([
		{ memoryBytes: 262_144_000, timeSeconds: 30 },
		{ memoryBytes: 262_144_001, timeSeconds: 60 },
		{ memoryBytes: 100, timeSeconds: 959 },
		{ memoryBytes: 100, timeSeconds: 960 },
	]);

	expect(result.calls).toEqual([
		"2:iflag=nocache count=0 status=none if=index",
		"2:iflag=nocache count=0 status=none if=table with spaces",
		"4:iflag=nocache count=0 status=none if=index",
		"4:iflag=nocache count=0 status=none if=table with spaces",
	]);
	expect(result.intervals).toEqual([30, 30, 30, 30]);
});

trim.it("the shell starts Railway's tini, wrapper and Postgres command with their original arguments", [], ({ checkMemory }) => {
	const result = checkMemory([{ memoryBytes: 100, timeSeconds: 30 }]);

	expect(result.startup).toEqual(["-g", "--", "/usr/local/bin/wrapper.sh", "postgres", "-p", "5432", "-c", "listen_addresses=*"]);
});

trim.it("the shell uses the app's threshold, check interval and fallback interval", [customTrim], ({ checkMemory }) => {
	const result = checkMemory([
		{ memoryBytes: 100, timeSeconds: 2 },
		{ memoryBytes: 101, timeSeconds: 4 },
		{ memoryBytes: 10, timeSeconds: 13 },
		{ memoryBytes: 10, timeSeconds: 14 },
	]);

	expect(result.calls).toEqual([
		"2:iflag=nocache count=0 status=none if=index",
		"2:iflag=nocache count=0 status=none if=table with spaces",
		"4:iflag=nocache count=0 status=none if=index",
		"4:iflag=nocache count=0 status=none if=table with spaces",
	]);
	expect(result.intervals).toEqual([2, 2, 2, 2]);
});
