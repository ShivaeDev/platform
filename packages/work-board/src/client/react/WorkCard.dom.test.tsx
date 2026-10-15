import { expect, it } from "vitest";
import { render } from "@shivaedev/effect-react/testing.ts";
import { nowWork } from "#test/nowWork.ts";
import { WorkCard } from "./WorkCard.tsx";

it("shows the orchestrator holder and hides missing PR and stage time", async () => {
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
	const view = await render(<WorkCard fleet={fleet} item={item} state={data.state} />);
	try {
		expect(view.container.textContent).toContain("Holder: orchestrator");
		expect(view.container.textContent).not.toContain("PR not recorded");
		expect(view.container.querySelectorAll("[data-status-token]")).toHaveLength(1);
		expect(view.container.querySelector("[data-status-token]")?.textContent).toBe("executing");
		expect(view.container.querySelector(".work-stage")).toBeNull();
	} finally {
		await view.unmount();
	}
});
