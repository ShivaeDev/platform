import { type Effect, Option, Predicate } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { answered } from "./answers.ts";
import type { jobsEngine } from "./jobsEngine.ts";
import { Mail } from "./jobsPages.ts";

export type Engine = Effect.Success<typeof jobsEngine>;
export interface Page {
	readonly cursor?: string;
	readonly limit: number;
}

const UNKNOWN_JOB = "00000000-0000-0000-0000-000000000001";
export const firstPage: Page = { limit: 10 };

export function nameOf(engine: Engine, id: string) {
	return id === UNKNOWN_JOB ? "an unknown job" : (engine.names.get(id) ?? `unnamed job ${id}`);
}

export function idOf(engine: Engine, name: string) {
	if (name === "an unknown job") {
		return UNKNOWN_JOB;
	}
	const id = engine.ids.get(name);
	if (id === undefined) {
		throw new Error(`No trait created ${name}`);
	}
	return id;
}

export function named(engine: Engine, id: string, name: string) {
	engine.ids.set(name, id);
	engine.names.set(id, name);
}

function rejection(output: unknown) {
	if (output === null || output === undefined) {
		return "no output";
	}
	return Predicate.isTagged(output, "WorkerRejected") && Predicate.hasProperty(output, "message")
		? String(output.message).split(":")[0]
		: `unrecognised output ${JSON.stringify(output)}`;
}

interface ListedJob {
	readonly attempt: number;
	readonly data: unknown;
	readonly id: string;
	readonly output: unknown;
	readonly queue: string;
	readonly state: string;
}

export function describeJob(engine: Engine, job: ListedJob) {
	return { attempt: job.attempt, job: nameOf(engine, job.id), output: rejection(job.output), payload: job.data, queue: job.queue, state: job.state };
}

export function describeCopy(
	engine: Engine,
	copy: ListedJob & { readonly sourceId: Option.Option<string>; readonly sourceOutput: unknown; readonly startedOn: Option.Option<unknown> },
) {
	return {
		copy: nameOf(engine, copy.id),
		payload: copy.data,
		queue: copy.queue,
		source: sourceOf(engine, copy),
		sourceOutput: rejection(copy.sourceOutput),
		started: Option.isSome(copy.startedOn) ? "started" : "not started",
	};
}

export function nextPage(engine: Engine, next: Option.Option<string>) {
	return Option.match(next, { onNone: () => "last page", onSome: (cursor) => `after ${nameOf(engine, cursor)}` });
}

function watch<A>(atom: Atom.Atom<AsyncResult.AsyncResult<A, unknown>>, shown: (value: A) => unknown) {
	return (registry: Engine["registry"], answer: (described: unknown) => void) =>
		registry.subscribe(
			atom,
			(result) => {
				if (AsyncResult.isSuccess(result) && !result.waiting) {
					answer(shown(result.value));
				}
			},
			{ immediate: true },
		);
}

export function views(engine: Engine) {
	const { api } = engine;
	return {
		"dead-lettered mail jobs": () =>
			watch(api.deadLettered.query({ ...firstPage, queue: Mail.name }), (page) => page.jobs.map(({ id }) => nameOf(engine, id))),
		"failed mail jobs": () => watch(api.failed.query({ ...firstPage, queue: Mail.name }), (page) => page.jobs.map(({ id }) => nameOf(engine, id))),
		health: () => watch(api.health.query(undefined), (health) => health.jobs.map(({ name }) => name)),
		"mail 42's detail": () =>
			watch(api.job.query({ id: idOf(engine, "mail 42"), queue: Mail.name }), (job) =>
				Option.match(job, { onNone: () => "no job", onSome: ({ state }) => (state === "failed" ? "failed" : "not failed") }),
			),
		"mail counts": () => watch(api.counts.query({ queue: Mail.name }), (counts) => `${counts.failedCount} failed`),
	};
}

export function sourceOf(engine: Engine, copy: { readonly sourceId: Option.Option<string> }) {
	return Option.match(copy.sourceId, { onNone: () => "no source", onSome: (id) => nameOf(engine, id) });
}

export function nameCopies(
	engine: Engine,
	copies: readonly { readonly id: string; readonly sourceId: Option.Option<string> }[],
	copyName: (source: string) => string,
) {
	for (const copy of copies) {
		Option.map(copy.sourceId, (source) => named(engine, copy.id, copyName(nameOf(engine, source))));
	}
}

export function refused<A, E, R>(engine: Engine, effect: Effect.Effect<A, E, R>) {
	return answered(effect, (id) => nameOf(engine, id));
}
