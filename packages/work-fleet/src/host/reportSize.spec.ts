import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

it.live.skipIf(storageDatabaseUrl === undefined)("an oversized report needs a human once across scheduler retries and host restart", () =>
	withHost({ "research.md": "---\nid: research\nkind: task\nfleet: approved\nfleet-deliverable: report\n---\n# Research\n" }, {}, (fixture) =>
		Effect.gen(function* () {
			yield* dispatchWork(fixture.host, "research", fixture.parts);
			for (const [id, current] of fixture.provider.observations) {
				fixture.provider.observations.set(id, { ...current, execution: "completed", output: "界".repeat((256 * 1024) / 3) });
			}
			const first = yield* Effect.gen(function* () {
				return yield* (yield* Fleet).reconcile("research");
			}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
			expect(first.value.stage).toBe("needs-human");
			expect(first.value.attentionOwner).toBe("orchestrator");
			expect(first.value.decision?.attentionOwner).toBe("orchestrator");
			expect(first.value.decision?.reason).toContain("256 KiB context limit");
			expect(first.value.decisionPublished).toBe(true);
			expect(first.value.report).toBeUndefined();
			const files = readdirSync(join(fixture.host.boardDir, "responses"));
			expect(files.some((file) => file.startsWith("fleet-report."))).toBe(false);
			yield* Effect.gen(function* () {
				const fleet = yield* Fleet;
				for (let pass = 0; pass < 3; pass += 1) {
					yield* cycle;
					expect(yield* fleet.get("research")).toEqual(first);
				}
			}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
			expect(readdirSync(join(fixture.host.boardDir, "responses"))).toEqual(files);
			expect(fixture.provider.launched).toHaveLength(1);
		}),
	),
);
