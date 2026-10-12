import { describeValue } from "#internal/render.ts";
import { explained } from "#internal/wrap.ts";

export function refusal(name: string, line: string, cause: unknown): Error {
	return new Error(
		explained(
			`the trait "${line}" refused to set up the ${name}: ${describeValue(cause)}`,
			`a trait throws when the ${name} it asks for cannot exist. Give the test traits that fit together, or fix the trait in the ${name} story kit if this ${name} should be possible.`,
		),
		{ cause },
	);
}

export function broken(name: string, steps: number, reason: string): Error {
	return new Error(
		explained(
			`the ${name} broke after ${steps} steps: ${reason}`,
			`run.failed in the ${name} story kit reports a state the ${name} cannot recover from. The story printed with this failure shows the setup and steps that led here.`,
		),
	);
}

export function unfinished(name: string, steps: number, diagnosis: string | undefined): Error {
	return new Error(
		explained(
			`the ${name} ran ${steps} steps and never reached what runUntil waits for${diagnosis === undefined ? "" : `: ${diagnosis}`}`,
			`either the ${name} never gets there, so check the setup and the engine, or it needs more steps, so pass a larger maxSteps to runUntil.`,
		),
	);
}

export function cannotRun(name: string): Error {
	return new Error(
		explained(
			`the ${name} story kit has no run hooks, so runUntil cannot step the ${name}`,
			`give the ${name} story kit run: { maxSteps, step }, where step advances the ${name} by one step.`,
		),
	);
}
