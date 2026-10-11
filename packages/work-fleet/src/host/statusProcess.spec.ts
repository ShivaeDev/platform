import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { dispatchWork } from "#host/commands.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("work-fleet status process against PostgreSQL", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);

	test("--board loads the host file and status filters stored work as text or JSON", function* () {
		yield* withHost({ "a.md": task("a", "approved"), "b.md": task("b", "approved") }, {}, (fixture) =>
			Effect.gen(function* () {
				yield* dispatchWork(fixture.host, "a", fixture.parts);
				yield* dispatchWork(fixture.host, "b", fixture.parts);
				const text = yield* Effect.promise(() => cliProcess(["status", "--board", fixture.host.boardDir]));
				expect(text.code).toBe(0);
				expect(text.stdout).toContain("Active (2)");
				expect(text.stdout).toContain("  a  executing");
				expect(text.stdout).toContain("  b  executing");
				expect(text.stdout).toContain("Needs human (0)\nCompleted (0)");
				const json = yield* Effect.promise(() => cliProcess(["status", "a", "--board", fixture.host.boardDir, "--json"]));
				expect(json.code).toBe(0);
				expect(JSON.parse(json.stdout)).toEqual({
					active: [expect.objectContaining({ stage: "executing", workId: "a" })],
					completed: [],
					needsHuman: [],
				});
			}),
		);
	}, 30_000);
});
