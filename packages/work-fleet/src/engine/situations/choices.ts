export interface Choice {
	readonly label: string;
	readonly outcome: string;
}

export interface Situation {
	readonly details?: boolean;
	readonly happened: string;
	readonly question?: string;
	readonly recommendation: string;
	readonly release?: Choice;
	readonly retry?: Choice;
}

export const RELEASE: Choice = {
	label: "Stop and hand back",
	outcome: "Fleet stops working on this task and hands it back to you. An open PR stays open.",
};
export const TRY_AGAIN: Choice = { label: "Try again", outcome: "Fleet repeats the step that stopped and continues the same work." };
export const RUN_AGAIN: Choice = { label: "Run the step again", outcome: "Fleet starts the step again and continues the same work." };
export const FRESH_WORKER: Choice = {
	label: "Start a fresh worker",
	outcome: "Fleet starts a new worker session with the same task. An existing branch and PR stay in use.",
};
export const CORRECT_REPORT: Choice = {
	label: "Ask for a corrected report",
	outcome: "Fleet asks the same worker to send its final report again in the expected format.",
};

export function blocked(happened: string, recommendation: string): Situation {
	return { details: true, happened, recommendation, retry: TRY_AGAIN };
}

export function stopOnly(happened: string, recommendation: string): Situation {
	return { happened, recommendation };
}
