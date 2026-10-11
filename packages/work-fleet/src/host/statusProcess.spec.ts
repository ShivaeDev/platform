import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { dispatchWork } from "#host/commands.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { daemonCli } from "#test/readDaemon.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("work-fleet status process against PostgreSQL", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);

	test("--board loads the host file and status filters stored work as text or JSON", function* () {
		yield* withHost({ "a.md": task("a", "approved"), "b.md": task("b", "approved") }, {}, (fixture) =>
			Effect.gen(function* () {
				yield* dispatchWork(fixture.host, "a", fixture.parts);
				yield* dispatchWork(fixture.host, "b", fixture.parts);
				const text = yield* daemonCli(fixture.host, ["status", "--board", fixture.host.boardDir]);
				expect(text.code).toBe(0);
				expect(text.stdout).toContain("Active (2)");
				expect(text.stdout).toContain("  a  executing");
				expect(text.stdout).toContain("  b  executing");
				expect(text.stdout).toContain("Waiting on maintainer (0)\nWaiting on orchestrator (0)\nWaiting on automation (0)\nCompleted (0)");
				const json = yield* daemonCli(fixture.host, ["status", "a", "--board", fixture.host.boardDir, "--json"]);
				expect(json.code).toBe(0);
				expect(JSON.parse(json.stdout)).toEqual({
					active: [expect.objectContaining({ stage: "executing", workId: "a" })],
					completed: [],
					waiting: { automation: [], maintainer: [], orchestrator: [] },
				});
			}),
		);
	}, 30_000);
});
