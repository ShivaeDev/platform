import { task } from "#test/fleetHost.ts";

const statuses = ["done", "deferred", "dropped", "ready", "draft"];
export const finishedDecisionWork = statuses.flatMap((status) =>
	["maintainer", "orchestrator"].map((responseFrom) => {
		const id = `work.${status}.${responseFrom}`;
		return { id, responseFrom, sourcePath: `decision.${id}.md`, status };
	}),
);

export const finishedDecisionFiles = Object.fromEntries(
	finishedDecisionWork.flatMap(({ id, responseFrom, sourcePath, status }) => [
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
						"response_from": [responseFrom],
						state: "open",
						unblocks: [id],
					},
				],
				id: `decision.${id}`,
				kind: "question",
				relationships: [{ kind: "relates_to", target: id }],
				scope: "task",
				urgency: "whenever",
			})}\n---\n# Fleet decision for ${id}\n\nChoose how to continue this work.\n`,
		],
	]),
);
