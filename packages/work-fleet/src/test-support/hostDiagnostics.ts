import { Context, Effect } from "effect";
import { HealthPublication } from "#engine/health.ts";
import { GithubApi } from "#host/githubApi.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

const observations = new WeakMap<HostStoryEngine, { reads: number; github: ReturnType<typeof syntheticGithub> }>();
export function configureHostDiagnostics(engine: HostStoryEngine) {
	const observed = { github: syntheticGithub({ remaining: 4568 }), reads: 0 };
	observed.github.reply("repos/example/project/pulls/7", { number: 7 });
	observations.set(engine, observed);
	engine.parts = { ...engine.parts, github: observed.github.layer };
	engine.diagnostics = {
		codex: Effect.sync(() => {
			observed.reads += 1;
			return { primary: { resetsAt: null, usedPercent: 12, windowDurationMins: 300 }, secondary: null };
		}),
		fleet: Effect.die("Daemon health must come from runtime state"),
		github: Effect.die("GitHub limits must come from Fleet's recorded responses"),
	};
}
export function hostDiagnosticsVerbs(engine: HostStoryEngine) {
	function observed() {
		const value = observations.get(engine);
		if (value === undefined) {
			throw new Error("Configure diagnostic sources first");
		}
		return value;
	}
	return {
		diagnosticReads: () => ({ codex: observed().reads, github: observed().github.requests.map(({ endpoint }) => endpoint) }),
		observeGithubBudget: () =>
			Context.get(engine.running.context, GithubApi)
				.get("repos/example/project/pulls/7")
				.pipe(Effect.andThen(Context.get(engine.running.context, HealthPublication))),
	};
}
