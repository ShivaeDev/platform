import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

for (const approval of ["approved", '"approved"', "pending", "[approved]", "{value: approved}"]) {
	boardStory.it(
		`projects the authored Fleet approval ${approval} through HTTP`,
		[projectFiles({ "task.md": `---\nid: task\nkind: task\nstatus: planned\nfleet: ${approval}\n---\n# Task` })],
		function* ({ rpc }) {
			const work = yield* rpc((client) => client("work-board.work", { url: "/_board/work" }));
			expect(work.rows[0]?.fleetApproved).toBe(approval === "approved" || approval === '"approved"');
		},
	);
}
for (const source of ["# No header", "---\nfleet: approved\nfleet: pending\n---\n# Duplicate", "---\nfleet: [\n---\n# Invalid"]) {
	boardStory.it(`does not invent Fleet approval for ${JSON.stringify(source)}`, [projectFiles({ "task.md": source })], function* ({ rpc }) {
		const work = yield* rpc((client) => client("work-board.work", { url: "/_board/work" }));
		expect(work.rows.some((item) => item.fleetApproved)).toBe(false);
	});
}
