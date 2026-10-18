import { Effect } from "effect";
import { expect } from "vitest";
import { nowWork } from "#test/nowWork.ts";
import { screenStory } from "#test/screenStory.ts";
import { WorkCard } from "./WorkCard.tsx";

screenStory.it("shows the orchestrator holder and hides missing PR and stage time", [], function* ({ render, read }) {
	const data = nowWork(1);
	const item = data.rows[0];
	if (!item) {
		throw new Error("Missing work fixture");
	}
	const fleet = {
		attentionOwner: "orchestrator" as const,
		document: null,
		stage: "executing" as const,
		stageEnteredAt: null,
		updatedAt: null,
		workId: item.id,
	};
	const view = yield* Effect.promise(() => render(<WorkCard fleet={fleet} item={item} state={data.state} />));

	expect(read().text).toContain("Holder: orchestrator");
	expect(read().text).not.toContain("PR not recorded");
	expect(view.container.querySelectorAll("[data-status-token]")).toHaveLength(1);
	expect(view.container.querySelector("[data-status-token]")?.textContent).toBe("executing");
	expect(view.container.querySelector(".work-stage")).toBeNull();
});
