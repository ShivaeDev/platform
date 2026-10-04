#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { execute, withAdministrativeFleet } from "./cliRuntime.ts";
import { protectDatabase, writeViews } from "./cliStorage.ts";
import { Batch, Policy } from "./domain.ts";
import { Fleet } from "./Fleet.ts";
import { failure } from "./ports.ts";

const database = Flag.string("database").pipe(Flag.withDescription("Durable SQLite file outside worker checkouts; one process owns it at a time"));
const output = Flag.string("output").pipe(Flag.withDefault("./fleet-views"), Flag.withDescription("Directory for generated Markdown views"));
const backend = Flag.choice("backend", ["codex-local", "scripted"]).pipe(
	Flag.withDescription("Explicit execution backend; scripted makes no external calls"),
);
const accept = Command.make("accept", { batch: Argument.fileSchema("batch", Batch), database }, (input) =>
	withAdministrativeFleet(input.database, (filename) =>
		Effect.gen(function* () {
			yield* protectDatabase(filename, input.batch.works);
			yield* (yield* Fleet).accept(input.batch);
		}),
	),
).pipe(Command.withDescription("Persist a batch; each work item still needs an approve decision"));
const decide = Command.make(
	"decide",
	{
		action: Argument.choice("action", ["approve", "merge", "hold", "resume"]),
		database,
		reason: Flag.string("reason"),
		work: Argument.string("work"),
	},
	(input) =>
		withAdministrativeFleet(input.database, () =>
			Effect.gen(function* () {
				yield* (yield* Fleet).decide(input.work, input.action, input.reason);
			}),
		),
).pipe(Command.withDescription("Record a scoped local operator decision"));
const recover = Command.make(
	"recover",
	{
		attempt: Argument.string("attempt"),
		database,
		notSubmitted: Flag.boolean("not-submitted").pipe(Flag.withDescription("Record that the operator verified this attempt was never submitted")),
		reason: Flag.string("reason"),
		session: Flag.string("session").pipe(Flag.optional),
		turn: Flag.string("turn").pipe(Flag.optional),
	},
	(input) =>
		withAdministrativeFleet(input.database, () =>
			Effect.gen(function* () {
				const sessionId = Option.getOrNull(input.session);
				const turnId = Option.getOrNull(input.turn);
				if (input.notSubmitted) {
					if (sessionId !== null || turnId !== null) {
						return yield* Effect.fail(failure("Do not combine --not-submitted with provider identifiers"));
					}
					return yield* (yield* Fleet).recover(input.attempt, null, input.reason);
				}
				if (sessionId === null || turnId === null) {
					return yield* Effect.fail(failure("Provide both --session and --turn"));
				}
				yield* (yield* Fleet).recover(input.attempt, { sessionId, turnId }, input.reason);
			}),
		),
).pipe(Command.withDescription("Recover an uncertain attempt from operator-verified provider evidence"));
const policy = Command.make("policy", { database, policy: Argument.fileSchema("policy", Policy) }, (input) =>
	withAdministrativeFleet(input.database, () =>
		Effect.gen(function* () {
			yield* (yield* Fleet).policy(input.policy);
		}),
	),
).pipe(Command.withDescription("Set capacity, attempt budget, admission stop and quota availability"));
const render = Command.make("render", { database, output }, (input) =>
	withAdministrativeFleet(input.database, () =>
		Effect.gen(function* () {
			yield* writeViews(yield* (yield* Fleet).snapshot(), input.output);
		}),
	),
).pipe(Command.withDescription("Generate Active, Completed and Needs human Markdown from durable state"));
const tick = Command.make("tick", { backend, database, output }, (input) => execute(input)).pipe(
	Command.withDescription("Observe, reconcile and admit one bounded round"),
);
const run = Command.make(
	"run",
	{
		backend,
		database,
		interval: Flag.integer("interval").pipe(
			Flag.withDefault(10),
			Flag.withDescription("Seconds between rounds; stop with Ctrl-C before using another command"),
		),
		output,
	},
	(input) => execute(input, input.interval),
).pipe(Command.withDescription("Run reconciliation until interrupted; state survives shutdown"));
const command = Command.make("work-fleet").pipe(
	Command.withDescription("Carry approved repository work through independent review and delivery"),
	Command.withSubcommands([accept, decide, recover, policy, render, tick, run]),
);
Command.run(command, { version: "0.1.0" }).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
