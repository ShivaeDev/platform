import { board } from "@shivaedev/work-board/server/integration/board.ts";

export const TASK_HEADING = "Approved task:";
const GOALS_HEADING = "Product goals:";

export function goalPrompt(goals: string): string {
	return goals ? `${GOALS_HEADING}\n\n${goals}` : "";
}

export function taskPrompt(source: string): string {
	const { body, fields } = board.metadataParse(source);
	return [
		body.trim(),
		...(fields.areas?.length ? ["Areas:", ...fields.areas.map((area) => `- ${area}`)] : []),
		...(fields.criteria?.length ? ["Acceptance criteria:", ...fields.criteria.map(({ text }) => `- ${text}`)] : []),
	].join("\n\n");
}

export function revisedTaskPrompt(prompt: string, previous: string | undefined, current: string, goals?: string): string {
	const revised = replaceTask(prompt, previous, current);
	if (goals === undefined) {
		return revised;
	}
	const task = revised.indexOf(`${TASK_HEADING}\n\n`);
	const start = revised.indexOf(`${GOALS_HEADING}\n\n`);
	const context = goalPrompt(goals);
	return `${revised.slice(0, start < 0 ? task : start)}${context ? `${context}\n\n` : ""}${revised.slice(task)}`;
}

function replaceTask(prompt: string, previous: string | undefined, current: string): string {
	if (previous === undefined) {
		return current;
	}
	if (prompt.includes(previous)) {
		return prompt.replace(previous, () => current);
	}
	const before = taskPrompt(previous);
	return prompt.includes(before) ? prompt.replace(before, () => taskPrompt(current)) : current;
}

export function workerBriefText(prompt: string, source: string): string {
	const task = prompt.indexOf(`${TASK_HEADING}\n\n`);
	if (task < 0) {
		return source;
	}
	const goals = prompt.indexOf(`${GOALS_HEADING}\n\n`);
	return `${goals < 0 ? "" : prompt.slice(goals, task)}${TASK_HEADING}\n\n${taskPrompt(source)}`;
}
