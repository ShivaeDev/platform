import { expect } from "vitest";
import { missingGreeting, scripts } from "#test/kit.ts";

scripts.it("typed arguments and environment Config reach the logged work, then the scope closes with exit 0", [], function* ({ start, finished }) {
	yield* start("Ada", "--count", "3");

	const result = yield* finished();
	expect(result).toMatchObject({
		code: 0,
		stderr: "",
		stdout: expect.stringMatching(/resource acquired[\s\S]*INFO[\s\S]*Hello Ada: 6[\s\S]*resource released/v),
	});
});

for (const [label, args, diagnostic] of [
	["an invalid integer", ["Ada", "--count", "no"], 'Invalid value for flag --count: "no".'],
	["an unknown flag", ["Ada", "--unknown"], "Unrecognized flag: --unknown"],
	["a missing positional argument", [], "Missing required argument: name"],
] as const) {
	scripts.it(`${label} reports its argument error and exits 1 without starting the work`, [], function* ({ start, finished }) {
		yield* start(...args);

		const result = yield* finished();
		expect(result).toMatchObject({
			code: 1,
			output: expect.stringContaining(diagnostic),
			stdout: expect.not.stringContaining("resource acquired"),
		});
	});
}

scripts.it("a typed failure is reported, closes the scope and exits 1", [], function* ({ start, finished }) {
	yield* start("Ada", "--mode", "failure");

	const result = yield* finished();
	expect(result).toMatchObject({
		code: 1,
		output: expect.stringContaining("The requested work failed"),
		stdout: expect.stringContaining("resource released"),
	});
});

scripts.it("missing Config is reported, closes the scope and exits 1", [missingGreeting], function* ({ start, finished }) {
	yield* start("Ada");

	const result = yield* finished();
	expect(result).toMatchObject({ code: 1, output: expect.stringContaining("SCRIPT_GREETING"), stdout: expect.stringContaining("resource released") });
});

scripts.it("help describes the arguments and exits 0 without running work or loading its Config", [missingGreeting], function* ({ start, finished }) {
	yield* start("--help");

	const result = yield* finished();
	expect(result).toMatchObject({
		code: 0,
		output: expect.stringContaining("--count"),
		stdout: expect.not.stringContaining("resource acquired"),
	});
});

scripts.it("Ctrl-C closes the running script's scope before exiting 130", [], function* ({ start, waiting, interrupt, finished }) {
	yield* start("Ada", "--mode", "wait");
	yield* waiting();

	yield* interrupt();

	const result = yield* finished();
	expect(result).toMatchObject({ code: 130, stdout: expect.stringContaining("resource released") });
});
