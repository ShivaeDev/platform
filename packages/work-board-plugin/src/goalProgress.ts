import type { WorkboardGoal } from "#types/index.d.ts";

export const goalStates = ["done", "running", "blocked", "scheduled", "parked"] as const;
export const goalColors = {
	blocked: "#d74253",
	done: "#16853f",
	parked: "#808080",
	running: "#2879da",
	scheduled: "#ad7400",
} as const;

export function goalBarSource(goal: WorkboardGoal): string {
	let offset = 0;
	const boundaries: number[] = [];
	const segments = goalStates
		.filter((state) => goal[state] > 0)
		.map((state) => {
			if (offset > 0) {
				boundaries.push(offset);
			}
			const width = Math.round((goal[state] / goal.total) * 1000) / 10;
			const segment = `<rect x="${offset}" width="${width}" height="6" fill="${goalColors[state]}"/>`;
			offset += width;
			return segment;
		})
		.join("");
	const separators = boundaries.map((x) => `<path d="M${x} 0v6" stroke="#000000" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join("");
	return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="6" viewBox="0 0 100 6" preserveAspectRatio="none">${segments}${separators}</svg>`;
}
