import { expect } from "@effect/vitest";
import { Schema } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { assessPreparation, pathsOverlap } from "#preparation/compatibility.ts";
import { Preparation, RepositoryPath } from "#preparation/schema.ts";
import { mainObservation, prepared } from "#test/preparation.ts";

it.effect("refreshes unrelated human main changes without claiming validation reran", function* () {
	const previous = prepared();
	const result = yield* assessPreparation(previous, mainObservation({ changedPaths: ["packages/unrelated/src/task.ts"] }));
	expect(result._tag).toBe("Compatible");
	if (result._tag === "Compatible") {
		expect(result.preparation.baseRevision).toBe("current-main");
		expect(result.preparation.observedAt).toBe(200);
		expect(result.preparation.validation).toBe(previous.validation);
		expect(result.preparation.validation[0]?.revision).toBe("prepared-main");
		expect(previous.baseRevision).toBe("prepared-main");
	}
});

it.effect("requires preparation for source, runner, dependency, quality and scoped baseline changes", function* () {
	const paths = [
		"packages/example/src/helper.ts",
		"script/update",
		"packages/dependency/src/index.ts",
		"pnpm-lock.yaml",
		"quality.config.ts",
		"packages/example/quality-baseline.json",
	];
	for (const path of paths) {
		expect(yield* assessPreparation(prepared(), mainObservation({ changedPaths: [path] }))).toEqual({
			_tag: "Reprepare",
			paths: [path],
			reason: "relevant-change",
		});
	}
});

it.effect("invalidates only the affected item's preparation", function* () {
	const observation = mainObservation({ changedPaths: ["packages/example/src/task.ts"] });
	const unrelated = prepared({ ownedPaths: ["packages/second/src/task.ts"], sourcePaths: ["packages/second/src"] });
	expect((yield* assessPreparation(prepared(), observation))._tag).toBe("Reprepare");
	expect((yield* assessPreparation(unrelated, observation))._tag).toBe("Compatible");
});

it.effect("accepts an unrelated performance script alias with complete configuration coverage", function* () {
	const observation = mainObservation({
		changedPaths: ["package.json"],
		configurationChanges: [{ complete: true, keys: ["scripts.performance"], path: "package.json" }],
	});
	expect((yield* assessPreparation(prepared(), observation))._tag).toBe("Compatible");
});

it.effect("uses scoped baseline semantic coverage without exempting relevant baseline changes", function* () {
	const preparation = prepared({
		baselinePaths: ["quality-baseline.json"],
		configuration: [{ path: "quality-baseline.json", relevantKeys: ["packages.example"] }],
	});
	const unrelated = mainObservation({
		changedPaths: ["quality-baseline.json", "packages/second/quality-baseline.json"],
		configurationChanges: [{ complete: true, keys: ["packages.second.complexity"], path: "quality-baseline.json" }],
	});
	expect((yield* assessPreparation(preparation, unrelated))._tag).toBe("Compatible");
	const relevant = mainObservation({
		changedPaths: ["quality-baseline.json"],
		configurationChanges: [{ complete: true, keys: ["packages.example.complexity"], path: "quality-baseline.json" }],
	});
	expect((yield* assessPreparation(preparation, relevant))._tag).toBe("Reprepare");
});

it.effect("requires preparation for relevant semantic configuration keys and ambiguous configuration", function* () {
	for (const keys of [["scripts.test"], ["scripts.setup"], ["dependencies.effect"], ["devDependencies.typescript"], ["scripts"]]) {
		expect(
			(yield* assessPreparation(
				prepared(),
				mainObservation({
					changedPaths: ["package.json"],
					configurationChanges: [{ complete: true, keys, path: "package.json" }],
				}),
			))._tag,
		).toBe("Reprepare");
	}
	for (const changes of [[], [{ complete: false, keys: ["scripts.performance"], path: "package.json" }]]) {
		expect((yield* assessPreparation(prepared(), mainObservation({ changedPaths: ["package.json"], configurationChanges: changes })))._tag).toBe(
			"Reprepare",
		);
	}
});

it.effect("refuses missing ancestry, stale evidence, incomplete observations and insufficient context", function* () {
	for (const observation of [
		mainObservation({ ancestor: false }),
		mainObservation({ fromRevision: "another-main" }),
		mainObservation({ complete: false }),
		mainObservation({ observedAt: 99 }),
	]) {
		expect((yield* assessPreparation(prepared(), observation))._tag).toBe("Reprepare");
	}
	expect((yield* assessPreparation(prepared({ contextComplete: false }), mainObservation()))._tag).toBe("Reprepare");
});

it.effect("does not let semantic coverage exempt a changed owned path", function* () {
	const result = yield* assessPreparation(
		prepared({ ownedPaths: ["package.json"] }),
		mainObservation({
			changedPaths: ["package.json"],
			configurationChanges: [{ complete: true, keys: ["scripts.performance"], path: "package.json" }],
		}),
	);
	expect(result._tag).toBe("Reprepare");
});

it.effect("matches native scope prefixes without conflating neighboring directory names", function* () {
	expect(pathsOverlap("packages/example", "packages/example/src/task.ts")).toBe(true);
	expect(pathsOverlap("packages/example/src/task.ts", "packages/example")).toBe(true);
	expect(pathsOverlap("packages/example", "packages/example-other/task.ts")).toBe(false);
	expect(pathsOverlap(".", "packages/example/task.ts")).toBe(true);
	yield* Schema.decodeUnknownEffect(Preparation)(prepared());
	for (const path of ["/tmp/private", "packages/../private", "packages//task", "packages\\task"]) {
		expect(Schema.is(RepositoryPath)(path)).toBe(false);
	}
});
