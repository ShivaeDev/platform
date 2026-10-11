import { describe, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { resolveHost } from "#host/config.ts";
import { MainSource } from "#host/mainSource.ts";
import { hostIntegrations } from "#host/runtime.ts";
import { FleetIntegrations } from "#policy.ts";
import { completed, HEAD, MOVED, NO_CHANGE, PR, resultFixture, work } from "#test/githubResult.ts";

describe("GitHub worker result adoption", () => {
	it.effect("adopts the observed PR number, exact reported head and all paginated changed paths", function* () {
		const fixture = resultFixture();
		const result = yield* fixture.adopt(work, completed());
		expect(result).toEqual({ head: HEAD, kind: "change", paths: ["src/one.ts", "src/two.ts"], pr: PR, prNumber: 7 });
		expect(fixture.requests).toEqual([
			["repo", "view", "--json", "nameWithOwner"],
			["api", "repos/example/repository/pulls/7"],
			["api", "repos/example/repository/pulls/7/files?per_page=100", "--paginate", "--slurp"],
			["api", "repos/example/repository/pulls/7"],
		]);
	});

	for (const before of [{ merged: true, state: "closed" }, {}]) {
		it.effect(`adopts a matching merged PR before or during path observation: ${JSON.stringify(before)}`, function* () {
			const fixture = resultFixture({ after: { merged: true, state: "closed" }, before });
			expect(yield* fixture.adopt(work, completed())).toEqual({
				head: HEAD,
				kind: "change",
				paths: ["src/one.ts", "src/two.ts"],
				pr: PR,
				prNumber: 7,
			});
		});
	}

	for (const wrap of ["", "`"]) {
		it.effect(`accepts final markers with whitespace and ${wrap === "" ? "plain" : "backtick-wrapped"} values`, function* () {
			const output = `Done.\r\n \tFLEET_HEAD:  ${wrap}${HEAD}${wrap} \t\r\n \tFLEET_PR:  ${wrap}${PR}${wrap} \t\r\n`;
			expect(yield* resultFixture().adopt(work, completed(output))).toMatchObject({ head: HEAD, kind: "change", pr: PR });
			const noChange = output.replace(`${wrap}${PR}${wrap}`, `${wrap}none${wrap}`);
			expect(yield* resultFixture().adopt(work, completed(noChange))).toEqual({ evidence: [noChange], head: HEAD, kind: "no-change" });
		});
	}

	it.effect("records both paths of a rename", function* () {
		const fixture = resultFixture({ files: [[{ filename: "src/one.ts", "previous_filename": "src/old.ts" }, { filename: "src/two.ts" }]] });
		expect(yield* fixture.adopt(work, completed())).toMatchObject({ paths: ["src/old.ts", "src/one.ts", "src/two.ts"] });
	});

	it.effect("retains the reported no-change head and evidence when main has moved", function* () {
		const fixture = resultFixture({ mainHead: MOVED });
		expect(yield* fixture.adopt(work, completed(NO_CHANGE))).toEqual({ evidence: [NO_CHANGE], head: HEAD, kind: "no-change" });
		expect(fixture.refreshes()).toBe(0);
		expect(fixture.requests).toHaveLength(0);
	});

	it.effect("host configuration selects adoption without granting no-change validation", function* () {
		const fixture = resultFixture();
		const integrations = yield* FleetIntegrations.pipe(
			Effect.provide(hostIntegrations(fixture.host).pipe(Layer.provide(Layer.succeed(MainSource)(fixture.main)))),
		);
		const result = yield* integrations.result(work, completed(NO_CHANGE));
		expect(result.kind).toBe("no-change");
		expect(yield* integrations.checks(work, result).pipe(Effect.flip)).toMatchObject({
			attentionOwner: "automation",
			message: "No-change validation is not configured in this Fleet host; inspect the worker session",
			reason: "integration",
		});
	});

	it.effect("leaves adoption unconfigured unless selected", function* () {
		const fixture = resultFixture();
		const integrations = yield* FleetIntegrations.pipe(
			Effect.provide(
				hostIntegrations(resolveHost("/synthetic/board", { provider: "local" })).pipe(Layer.provide(Layer.succeed(MainSource)(fixture.main))),
			),
		);
		expect(yield* integrations.result(work, completed()).pipe(Effect.flip)).toMatchObject({ reason: "integration" });
	});
});
