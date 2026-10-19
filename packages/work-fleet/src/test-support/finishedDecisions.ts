import { task } from "#test/fleetHost.ts";

const statuses = ["done", "deferred", "superseded", "active", "ready", "planned"];
export const finishedDecisionWork = Array.from({ length: 600 }, (_, index) => ({
	id: `work.${index}`,
	sourcePath: `decision.work.${index}.md`,
	status: statuses[index % statuses.length] ?? "active",
}));

export const finishedDecisionFiles = Object.fromEntries(
	finishedDecisionWork.flatMap(({ id, sourcePath, status }, index) => [
		[`${id}.md`, task(id).replace("kind: task", `kind: task\nstatus: ${status}`)],
		[
			sourcePath,
			`---\n${JSON.stringify({
				attention: [
					{
						id: `${id}.1`,
						kind: "decision",
						managed: true,
						reason: "Choose how to continue",
						"response_from": [index % 2 === 0 ? "maintainer" : "orchestrator"],
						state: "open",
						unblocks: [id],
					},
				],
				id: `decision.${id}`,
				kind: "decision",
				relationships: [{ kind: "relates_to", target: id }],
			})}\n---\n# Fleet decision for ${id}\n\nChoose how to continue this work.\n`,
		],
	]),
);
