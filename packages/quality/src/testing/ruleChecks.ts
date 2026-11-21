import { Cause, Effect, Path } from "effect";
import { configureRegistered } from "#adapters/rule.ts";
import { permitted, reported } from "#engine/unsafeFindings.ts";
import type { Findings, RegisteredRule, Rule, RuleInputs } from "#rule.ts";
import type { Run } from "#testing/adapters/cli.ts";
import { scanned } from "#testing/adapters/imports.ts";

export interface RuleEngine {
	answer: Run | undefined;
	failure: string | undefined;
	findings: Findings | undefined;
	readonly root: string;
}

// The gate drops what adapters/ and test-support/ permit, so a checked rule reads the same findings.
function gated(findings: Findings): Findings {
	return findings.filter((finding) => !permitted(finding)).map(reported);
}

export function ruleChecks(engine: RuleEngine, tell: (line: string) => void) {
	return {
		check: Effect.fn("RuleStory.check")(function* <TInput>(
			rule: Rule<string, TInput>,
			options?: TInput,
			directory = ".",
			entries?: readonly string[],
		) {
			tell(options === undefined ? `quality checks ${rule.id}` : `quality checks ${rule.id} with ${JSON.stringify(options)}`);
			const configured = yield* Effect.promise(() => rule.configure(options));
			if (configured._tag === "Invalid") {
				return yield* Effect.die(new Error(`${rule.id} refused its options: ${configured.issues.join("; ")}`));
			}
			const path = yield* Path.Path;
			const scannedInputs = yield* Effect.promise(() => scanned(path.join(engine.root, directory)));
			const inputs: RuleInputs = entries === undefined ? scannedInputs : { ...scannedInputs, entries };
			engine.findings = gated(yield* configured.check(inputs));
			return engine.findings;
		}),
		checkOutcome: Effect.fn("RuleStory.checkOutcome")(function* <TInput>(rule: Rule<string, TInput>, entries: readonly string[]) {
			tell(`quality checks ${rule.id} with declared entries`);
			const configured = yield* Effect.promise(() => rule.configure(undefined));
			if (configured._tag === "Invalid") {
				return yield* Effect.die(new Error(`${rule.id} refused its options: ${configured.issues.join("; ")}`));
			}
			const inputs = yield* Effect.promise(() => scanned(engine.root));
			const result = yield* Effect.exit(configured.check({ ...inputs, entries }));
			if (result._tag === "Failure") {
				engine.failure = Cause.pretty(result.cause);
				return "failed";
			}
			engine.failure = undefined;
			engine.findings = gated(result.value);
			return "passed";
		}),
		failureMessage: () =>
			engine.failure === undefined ? Effect.die(new Error("Run a failed check before reading its failure message")) : Effect.succeed(engine.failure),
		optionIssues: Effect.fn("RuleStory.optionIssues")(function* (rule: RegisteredRule, options: unknown) {
			tell(`quality configures ${rule.id} with ${JSON.stringify(options)}`);
			const configured = yield* Effect.promise(() => configureRegistered(rule, options));
			return configured._tag === "Invalid" ? configured.issues : [];
		}),
	};
}
