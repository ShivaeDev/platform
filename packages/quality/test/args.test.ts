import { describe, expect, it } from "vitest";
import { parseCommand } from "../src/cli/args.ts";

describe("command line", () => {
	it.each([
		[[], { _tag: "Lint", config: undefined, warnings: "summary" }],
		[["lint", "--warnings", "all", "--config", "tools/quality.config.ts"], { _tag: "Lint", config: "tools/quality.config.ts", warnings: "all" }],
		[["baseline", "write"], { _tag: "BaselineWrite", config: undefined, rules: [] }],
		[["baseline", "write", "--rule", "a/b", "--rule", "c/d"], { _tag: "BaselineWrite", config: undefined, rules: ["a/b", "c/d"] }],
		[["baseline", "prune"], { _tag: "BaselinePrune", config: undefined }],
		[["--help"], { _tag: "Help" }],
		[["help"], { _tag: "Help" }],
	])("parses %j", (args, command) => {
		expect(parseCommand(args)).toEqual({ _tag: "Parsed", command });
	});

	it.each([
		[["lint", "--bogus"], "Unknown option"],
		[["lint", "--warnings", "loud"], "--warnings takes summary or all"],
		[["lint", "--rule", "a/b"], "--rule applies only to baseline write"],
		[["baseline", "prune", "--rule", "a/b"], "--rule applies only to baseline write"],
		[["baseline", "write", "--warnings", "all"], "--warnings applies only to lint"],
		[["baseline"], "baseline takes write or prune"],
		[["baseline", "write", "now"], "unknown command"],
		[["check"], "unknown command"],
	])("rejects %j", (args, problem) => {
		expect(parseCommand(args)).toEqual({ _tag: "Usage", problem: expect.stringContaining(problem) });
	});
});
