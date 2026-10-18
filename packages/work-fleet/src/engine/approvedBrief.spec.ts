import { readdirSync } from "node:fs";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = postgresTests("test");

test("an approved executing brief advances in place while removing approval still requests a decision", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const files = boardHttpFiles(root);
			files.write("two.md", source.replace("id: one", "id: two"));
			yield* prepareWork("one");
			yield* prepareWork("two");
			const worker = yield* fleet.dispatch("one");
			yield* fleet.dispatch("two");
			const current = `${source.replace("kind: task", "kind: task\nowner: codex")}\nRevised acceptance criteria.\n`;
			files.write("one.md", current);
			const continued = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
			expect(continued.value.stage).toBe("executing");
			expect(continued.value.boardRevision).toBe(briefRevision(metadataParse(current)));
			expect(continued.value.boardRevision).not.toBe(worker.value.boardRevision);
			expect(continued.value.boardContext).toBe(current);
			expect(continued.value.prompt).toContain(current);
			expect(continued.value.attempts[0]?.receipt).toEqual(worker.value.attempts[0]?.receipt);
			expect(continued.value.attempts).toHaveLength(1);
			expect(continued.value.decision).toBeUndefined();
			expect(readdirSync(root, { recursive: true }).some((file) => file.includes("decision."))).toBe(false);
			files.write("two.md", source.replace("id: one", "id: two").replace("fleet: approved\n", ""));
			const stopped = yield* fleet.reconcile("two");
			expect(stopped.value.stage).toBe("needs-human");
			expect(stopped.value.decision?.published).toBeDefined();
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
		}),
	));

for (const field of ["owner: human", "status: done", "status: superseded", "status: deferred", "fleet: draft"]) {
	test(`a changed brief with ${field} still stops for a human`, () =>
		withFleetBoard({}, (_fixture, root, source) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				const worker = yield* fleet.dispatch("one");
				const current = `${source.replace("fleet: approved", field.startsWith("fleet:") ? field : `fleet: approved\n${field}`)}\nRevised scope.\n`;
				boardHttpFiles(root).write("one.md", current);
				const stopped = yield* fleet.reconcile("one");
				expect(stopped.value.stage).toBe("needs-human");
				expect(stopped.value.decision?.reason).toBe("Board context changed");
				expect(stopped.value.boardRevision).toBe(worker.value.boardRevision);
				expect(stopped.value.attempts[0]?.receipt).toEqual(worker.value.attempts[0]?.receipt);
			}),
		));
}
