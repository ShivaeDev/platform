import { describeValue } from "#internal/render.ts";

export function refusal(name: string, line: string, cause: unknown): Error {
	return new Error(
		[
			`the trait "${line}" refused to set up the ${name}: ${describeValue(cause)}`,
			`help: a trait throws when the ${name} it asks for cannot exist. Give the test traits that fit together, or fix the trait in the ${name} story kit if this ${name} should be possible.`,
		].join("\n"),
		{ cause },
	);
}

export function broken(name: string, steps: number, reason: string): Error {
	return new Error(
		[
			`the ${name} broke after ${steps} steps: ${reason}`,
			`help: run.failed in the ${name} story kit reports a state the ${name} cannot recover from. The story printed with this failure shows the setup and steps that led here.`,
		].join("\n"),
	);
}

export function unfinished(name: string, steps: number, diagnosis: string | undefined): Error {
	return new Error(
		[
			`the ${name} ran ${steps} steps and never reached what runUntil waits for${diagnosis === undefined ? "" : `: ${diagnosis}`}`,
			`help: either the ${name} never gets there, so check the setup and the engine, or it needs more steps, so pass a larger maxSteps to runUntil.`,
		].join("\n"),
	);
}

export function cannotRun(name: string): Error {
	return new Error(
		[
			`the ${name} story kit has no run hooks, so runUntil cannot step the ${name}`,
			`help: give the ${name} story kit run: { maxSteps, step }, where step advances the ${name} by one step.`,
		].join("\n"),
	);
}
