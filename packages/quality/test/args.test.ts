import { describe, expect, it } from "vitest";
import { parseCommand } from "../src/cli/args.ts";

describe("command line", () => {
	it.each([
		[[], { _tag: "Lint", config: undefined, warnings: "summary" }],
		[["lint", "--warnings", "all", "--config", "tools/quality.config.ts"], { _tag: "Lint", config: "tools/quality.config.ts", warnings: "all" }],
		[["fix"], { _tag: "Fix", config: undefined }],
		[["baseline", "write"], { _tag: "BaselineWrite", config: undefined, rules: [] }],
		[["baseline", "write", "--rule", "a/b", "--rule", "c/d"], { _tag: "BaselineWrite", config: undefined, rules: ["a/b", "c/d"] }],
		[["baseline", "prune"], { _tag: "BaselinePrune", against: undefined, config: undefined }],
		[["baseline", "prune", "--against", "upstream/trunk"], { _tag: "BaselinePrune", against: "upstream/trunk", config: undefined }],
		[["baseline", "prune", "--against", "origin/main", "--config", "q.ts"], { _tag: "BaselinePrune", against: "origin/main", config: "q.ts" }],
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
		[["baseline"], "baseline takes write, prune, tighten or migrate"],
		[["lint", "--against", "origin/main"], "--against applies only to baseline prune"],
		[["baseline", "write", "--staged"], "--staged applies only to baseline tighten"],
		[["fix", "--lint"], "Unknown option '--lint'"],
		[["baseline", "prune", "--from", "old.json"], "--from applies only to baseline migrate"],
		[["baseline", "prune", "--against=--output=x"], "--against takes a git ref"],
		[["baseline", "check"], "baseline takes write, prune, tighten or migrate"],
		[["baseline", "write", "now"], "unknown command"],
		[["check"], "unknown command"],
		[
			["adopt", "comments/no-todo"],
			"`quality adopt` was removed in 0.7.0. To record a rule's existing findings in the baseline, run `quality baseline write --rule <id>`",
		],
	])("rejects %j", (args, problem) => {
		expect(parseCommand(args)).toEqual({ _tag: "Usage", problem: expect.stringContaining(problem) });
	});
});
