import { expect } from "@effect/vitest";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

engine.it(
	"an approved working brief advances in place while removing approval still requests a decision",
	[markdownWork()],
	function* ({ boardBrief, writeBoardWork, publishedDocuments, providerCalls, prepareWork, restart, fleet }) {
		const source = boardBrief();
		writeBoardWork("two.md", source.replace("id: one", "id: two"));
		yield* prepareWork("one");
		yield* prepareWork("two");
		const worker = yield* fleet.dispatch("one");
		yield* fleet.dispatch("two");
		const current = `${source.replace("kind: task", "kind: task\nowner: codex")}\nRevised acceptance criteria.\n`;
		writeBoardWork("one.md", current);
		yield* restart();
		const continued = yield* fleet.reconcile("one");
		expect(continued.value.step).toBe("working");
		expect(continued.value.boardRevision).toBe(briefRevision(metadataParse(current)));
		expect(continued.value.boardRevision).not.toBe(worker.value.boardRevision);
		expect(continued.value.boardContext).toBe(current);
		expect(continued.value.prompt).toContain(current);
		expect(continued.value.attempts).toMatchObject([
			{ operationId: worker.value.attempts[0]?.operationId, receipt: worker.value.attempts[0]?.receipt },
		]);
		expect(continued.value.decision).toBeUndefined();
		expect(publishedDocuments().some(({ file }) => file.includes("decision."))).toBe(false);
		writeBoardWork("two.md", source.replace("id: one", "id: two").replace("fleet: approved\n", ""));
		const stopped = yield* fleet.reconcile("two");
		expect(stopped.value.step).toBe("waiting");
		expect(stopped.value.decision?.published).toBeDefined();
		expect(
			providerCalls()
				.filter((call) => call.call === "turn")
				.map(({ operationId }) => operationId),
		).toEqual(["operation-1", "operation-2"]);
	},
);

for (const field of ["owner: marvin", "status: done", "status: dropped", "status: deferred", "fleet: held"]) {
	engine.it(
		`a changed brief with ${field} still stops for a human`,
		[markdownWork()],
		function* ({ boardBrief, writeBoardWork, prepareWork, fleet }) {
			const source = boardBrief();
			yield* prepareWork("one");
			const worker = yield* fleet.dispatch("one");
			const current = `${source.replace("fleet: approved", field.startsWith("fleet:") ? field : `fleet: approved\n${field}`)}\nRevised scope.\n`;
			writeBoardWork("one.md", current);
			const stopped = yield* fleet.reconcile("one");
			expect(stopped.value.step).toBe("waiting");
			expect(stopped.value.decision?.reason).toBe("Board context changed");
			expect(stopped.value.boardRevision).toBe(worker.value.boardRevision);
			expect(stopped.value.attempts[0]?.receipt).toEqual(worker.value.attempts[0]?.receipt);
		},
	);
}
