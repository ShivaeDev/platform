import type { WorkboardGoal } from "#types/index.d.ts";

export const goalStates = ["done", "running", "blocked", "scheduled", "parked"] as const;
export const goalColors = {
	blocked: "#ce0030",
	done: "#00a83b",
	parked: "#767676",
	running: "#b56b00",
	scheduled: "#0065ff",
} as const;

export function goalBarSource(goal: WorkboardGoal): string {
	let offset = 0;
	const segments = goalStates
		.map((state) => {
			const width = Math.round((goal[state] / goal.total) * 1000) / 10;
			const segment = `<rect x="${offset}" width="${width}" height="6" fill="${goalColors[state]}"/>`;
			offset += width;
			return segment;
		})
		.join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="6" viewBox="0 0 100 6" preserveAspectRatio="none">${segments}</svg>`;
}
