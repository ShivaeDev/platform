import { BRIDGES, bridgingAdapters, plainAdapters, reportedFiles, serviceFolders } from "#test/adapterBridgeFiles.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { qualityInstalled, repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";
import { assertThat } from "#testing/assertThat.ts";

ruleStory.it(
	"effect/adapter-bridges reports adapters/ modules that use nothing forbidden elsewhere: pure path matching, a type-only library import, a library call returning a plain value and an ambient time read banned in adapters/ too",
	[qualityInstalled(), effectResolves(), repositoryHas(...plainAdapters)],
	function* ({ gate, gateReports }) {
		yield* gate();

		yield* assertThat(reportedFiles(yield* gateReports("effect/adapter-bridges")), (actual) =>
			actual.toEqual(["src/adapters/browserTargets.ts", "src/adapters/matchAdminRoute.ts", "src/adapters/retries.ts", "src/adapters/stamp.ts"]),
		);
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/adapter-bridges accepts adapters/ modules with a Promise, a library Promise seen only by the typed half, a Node builtin, a captured context, a bare …Unsafe call, a hidden cast, a timer and a browser I/O global, and reports none of them",
	[qualityInstalled(), effectResolves(), repositoryHas(...bridgingAdapters)],
	function* ({ gate, gateReports }) {
		yield* gate();

		yield* assertThat(yield* gateReports("effect/adapter-bridges"), (actual) => actual.toBe(""));
		yield* assertThat(
			[yield* gateReports("effect/"), yield* gateReports("biome/plugin"), yield* gateReports("suppressions/")].join("\n"),
			(actual) => {
				for (const path of Object.keys(BRIDGES)) {
					actual.not.toContain(path);
				}
			},
		);
	},
	CLI_TIMEOUT,
);

ruleStory.it(
	"effect/adapter-bridges keeps a service folder in adapters/ while one operation uses a timer and reports every module of a service folder that uses nothing forbidden elsewhere",
	[qualityInstalled(), effectResolves(), repositoryHas(...serviceFolders)],
	function* ({ gate, gateReports }) {
		yield* gate();

		yield* assertThat(reportedFiles(yield* gateReports("effect/adapter-bridges")), (actual) =>
			actual.toEqual(["src/adapters/labels/label.ts", "src/adapters/labels/service.ts"]),
		);
	},
	CLI_TIMEOUT,
);
