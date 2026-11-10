import { Result } from "effect";
import { type EventKind, eventKinds } from "#events.ts";
import { type Options, WatchError } from "#model.ts";
import type { WaitOptions } from "#waitFor.ts";

export interface Input {
	readonly apiUrl: string;
	readonly events?: string | undefined;
	readonly fleet: boolean;
	readonly heartbeat: number;
	readonly interval: number;
	readonly numbers: readonly number[];
	readonly once: boolean;
	readonly repository: string;
	readonly stateFile?: string | undefined;
}

export function optionsFor(input: Input) {
	return Result.gen(function* () {
		if (!/^[\w.-]+\/[\w.-]+$/u.test(input.repository)) {
			return yield* invalid("--repo OWNER/REPO is required");
		}
		const numbers = yield* numbersFor(input);
		if (!Number.isFinite(input.interval) || input.interval < 1) {
			return yield* invalid("--interval must be at least one second");
		}
		if (!Number.isFinite(input.heartbeat) || input.heartbeat < 0) {
			return yield* invalid("--heartbeat must be zero or more seconds");
		}
		const apiUrl = yield* apiUrlFor(input.apiUrl);
		const events = yield* eventsFor(input.events);
		return {
			heartbeat: input.heartbeat * 1000,
			once: input.once,
			options: {
				apiUrl,
				...(events === undefined ? {} : { events }),
				fleet: input.fleet,
				interval: input.interval * 1000,
				numbers,
				repository: input.repository,
				stateFile: input.stateFile ?? `.pr-watch/${input.repository.replace("/", "-")}.json`,
			} satisfies Options,
		};
	});
}

export function waitOptionsFor(input: {
	readonly apiUrl: string;
	readonly number: number;
	readonly repository: string;
	readonly stateFile?: string | undefined;
	readonly timeout?: number | undefined;
}) {
	return Result.gen(function* () {
		const { options } = yield* optionsFor({
			apiUrl: input.apiUrl,
			fleet: false,
			heartbeat: 0,
			interval: 60,
			numbers: [input.number],
			once: false,
			repository: input.repository,
			stateFile: input.stateFile ?? `.pr-watch/${input.repository.replace("/", "-")}-${input.number}.json`,
		});
		if (input.timeout !== undefined && !(Number.isFinite(input.timeout) && input.timeout >= 1)) {
			return yield* invalid("--timeout must be at least one second");
		}
		return {
			apiUrl: options.apiUrl,
			number: input.number,
			repository: options.repository,
			stateFile: options.stateFile,
			...(input.timeout === undefined ? {} : { timeout: input.timeout * 1000 }),
		} satisfies WaitOptions;
	});
}

function invalid(message: string) {
	return Result.fail(new WatchError({ message, reason: "arguments" }));
}

function apiUrlFor(value: string) {
	return Result.gen(function* () {
		const apiUrl = value.replace(/\/$/u, "");
		const url = yield* Result.try({
			catch: (cause) => new WatchError({ message: "--api-url requires HTTPS (or loopback HTTP)", reason: "arguments" }, { cause }),
			try: () => new URL(apiUrl),
		});
		const secure = url.protocol === "https:";
		const loopback = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
		if (!(secure || loopback) || url.username || url.password || url.search || url.hash) {
			return yield* invalid("--api-url requires HTTPS (or loopback HTTP)");
		}
		return apiUrl;
	});
}

function eventsFor(value: string | undefined) {
	return Result.gen(function* () {
		let events: EventKind[] | undefined;
		if (value !== undefined) {
			events = [];
			for (const name of value.split(",")) {
				const kind = eventKinds.find((valid) => valid === name);
				if (kind === undefined) {
					return yield* invalid(`Unknown event kind ${JSON.stringify(name)}. Valid kinds: ${eventKinds.join(", ")}`);
				}
				events.push(kind);
			}
		}
		return events;
	});
}

function numbersFor(input: Input) {
	if (input.numbers.some((number) => !Number.isSafeInteger(number) || number < 1)) {
		return invalid("PR numbers must be positive integers");
	}
	const numbers = [...new Set(input.numbers)];
	if (input.fleet ? numbers.length > 0 : numbers.length === 0) {
		return invalid("Choose --fleet or one or more PR numbers");
	}
	return Result.succeed(numbers);
}
