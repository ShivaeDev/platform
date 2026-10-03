import { describe, expect, it } from "vitest";
import { parseCommand } from "../src/cli/args.ts";

describe("command line", () => {
	it.each([
		[[], { _tag: "Lint", config: undefined, warnings: "summary" }],
		[["lint", "--warnings", "all", "--config", "tools/quality.config.ts"], { _tag: "Lint", config: "tools/quality.config.ts", warnings: "all" }],
		[["baseline", "write"], { _tag: "BaselineWrite", config: undefined, rules: [] }],
		[["baseline", "write", "--rule", "a/b", "--rule", "c/d"], { _tag: "BaselineWrite", config: undefined, rules: ["a/b", "c/d"] }],
		[["baseline", "prune"], { _tag: "BaselinePrune", against: undefined, config: undefined }],
		[["baseline", "prune", "--against", "upstream/trunk"], { _tag: "BaselinePrune", against: "upstream/trunk", config: undefined }],
		[["baseline", "check"], { _tag: "BaselineCheck", against: undefined, config: undefined }],
		[["baseline", "check", "--against", "origin/main", "--config", "q.ts"], { _tag: "BaselineCheck", against: "origin/main", config: "q.ts" }],
		[["baseline", "tighten", "--staged"], { _tag: "BaselineTighten", config: undefined, staged: true }],
		[["baseline", "tighten"], { _tag: "BaselineTighten", config: undefined, staged: false }],
		[["baseline", "migrate", "--from", "debt.json"], { _tag: "BaselineMigrate", config: undefined, from: "debt.json" }],
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
		[["baseline"], "baseline takes write, prune, tighten, check or migrate"],
		[["lint", "--against", "origin/main"], "--against applies only to baseline prune and baseline check"],
		[["baseline", "write", "--staged"], "--staged applies only to baseline tighten"],
		[["baseline", "check", "--from", "old.json"], "--from applies only to baseline migrate"],
		[["baseline", "check", "--rule", "a/b"], "--rule applies only to baseline write"],
		[["baseline", "check", "--against=--output=x"], "--against takes a git ref"],
		[["baseline", "write", "now"], "unknown command"],
		[["check"], "unknown command"],
	])("rejects %j", (args, problem) => {
		expect(parseCommand(args)).toEqual({ _tag: "Usage", problem: expect.stringContaining(problem) });
	});
});
