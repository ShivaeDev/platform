import { Effect } from "effect";
import { type EventKind, eventKinds } from "#events.ts";
import { type Options, WatchError } from "#model.ts";

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

export const optionsFor = Effect.fnUntraced(function* (input: Input) {
	if (!/^[\w.-]+\/[\w.-]+$/u.test(input.repository)) {
		return yield* invalid("--repo OWNER/REPO is required");
	}
	if (input.numbers.some((number) => !Number.isSafeInteger(number) || number < 1)) {
		return yield* invalid("PR numbers must be positive integers");
	}
	const numbers = [...new Set(input.numbers)];
	if (input.fleet ? numbers.length > 0 : numbers.length === 0) {
		return yield* invalid("Choose --fleet or one or more PR numbers");
	}
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

function invalid(message: string) {
	return Effect.fail(new WatchError({ message, reason: "arguments" }));
}

const apiUrlFor = Effect.fnUntraced(function* (value: string) {
	const apiUrl = value.replace(/\/$/u, "");
	const url = yield* Effect.try({
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

const eventsFor = Effect.fnUntraced(function* (value: string | undefined) {
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
