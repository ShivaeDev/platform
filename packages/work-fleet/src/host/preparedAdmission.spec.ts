import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { countBriefParses } from "#test/hostReadPass.ts";
import { approvedWork, boardWork, host } from "#test/hostStory.ts";

const one = task("one", "approved").replace("kind: task", "kind: task\nareas: [shared]");
const two = one.replaceAll("one", "two");

for (const mode of ["scheduler", "dispatch"] as const) {
	for (const areas of ["areas: [other]", ""] as const) {
		host.it(
			`${mode} admits a prepared area waiter after its areas are ${areas === "" ? "removed" : "changed"}`,
			[boardWork({ "one.md": one, "two.md": two })],
			function* (daemon) {
				yield* daemon.approve("one");
				yield* daemon.admit();
				yield* daemon.schedule();
				const waiting = yield* daemon.get("two");
				expect(waiting).toMatchObject({ attempts: [], blocker: "waiting for area shared held by one", stage: "prepared" });
				const edited = two.replace("areas: [shared]", areas);
				daemon.writeBoard("two.md", edited);
				if (mode === "scheduler") {
					yield* daemon.admit();
					yield* daemon.schedule();
				} else {
					yield* daemon.approve("two");
				}
				const launched = yield* daemon.get("two");
				expect(launched.stage).toBe("executing");
				expect(launched.areas ?? []).toEqual(areas === "" ? [] : ["other"]);
				expect(launched.blocker).toBeUndefined();
				expect(launched.attempts).toHaveLength(1);
				expect(launched.boardRevision).toBe(waiting.boardRevision);
				expect(launched.boardContext).toBe(edited);
				expect(launched.prompt).toContain(edited);
				expect((yield* daemon.get("one")).stage).toBe("executing");
				expect(daemon.providerStarts()).toHaveLength(2);
			},
		);
	}

	const independent = task("two", "approved");
	const dependent = independent.replace("kind: task", "kind: task\nrelationships: [{ kind: depends_on, target: one }]");
	host.it(
		`${mode} uses edited dependencies for a prepared waiter`,
		[boardWork({ "one.md": task("one", "approved"), "two.md": dependent })],
		function* (daemon) {
			yield* daemon.approve("one");
			yield* daemon.admit();
			yield* daemon.schedule();
			expect(yield* daemon.get("two")).toMatchObject({
				attempts: [],
				blocker: expect.stringContaining("waiting for dependency one"),
				stage: "prepared",
			});
			daemon.writeBoard("two.md", independent);
			if (mode === "scheduler") {
				yield* daemon.admit();
				yield* daemon.schedule();
			} else {
				yield* daemon.approve("two");
			}
			expect(yield* daemon.get("two")).toMatchObject({ boardContext: independent, stage: "executing" });
			expect((yield* daemon.get("one")).stage).toBe("executing");
			expect(daemon.providerStarts()).toHaveLength(2);
		},
	);
}

host.it("scheduler passes leave an unchanged area wait unwritten", [boardWork({ "one.md": one, "two.md": two })], function* (daemon) {
	yield* daemon.approve("one");
	yield* daemon.admit();
	yield* daemon.schedule();
	const waiting = yield* daemon.storedRecord("two");
	expect(waiting.value).toMatchObject({ blocker: "waiting for area shared held by one", stage: "prepared" });
	yield* daemon.schedule();
	yield* daemon.schedule();
	expect(yield* daemon.storedRecord("two")).toEqual(waiting);
});

const ids = ["one", "two", "three"];
host.it(
	"one scheduler pass parses each approved brief once to admit it and once to launch it",
	[approvedWork(ids), boardWork({}, { concurrency: ids.length }), countBriefParses],
	function* (daemon) {
		const result = yield* daemon.schedulerPass();
		expect(result.dispatched.map((dispatch) => dispatch._tag)).toEqual(ids.map(() => "Success"));
		expect(daemon.providerStarts()).toHaveLength(ids.length);
		expect(daemon.briefParseCount()).toBe(ids.length * 2);
	},
);
