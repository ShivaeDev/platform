import { expect } from "@effect/vitest";
import { makeDatabase } from "@shivaedev/effect-prisma";
import { makeEffectTRPC, makeRequestServices } from "@shivaedev/effect-trpc";
import { initTRPC } from "@trpc/server";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { afterAll } from "vitest";
import {
	type Contract,
	contractJson,
} from "../../effect-prisma/test/contract.js";
import { makePlatformRuntime } from "../src/runtime.js";
import { makePlatformIt } from "../src/testing.js";

const databaseUrl = process.env.PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL;
const Database = makeDatabase<Contract>("@test/PlatformDatabase", {
	contractJson,
});
const DatabaseLive = Database.layer({
	url: databaseUrl ?? "postgresql://integration-tests-disabled",
});

interface CallerOptions {
	readonly actor: string;
}

class Actor extends Context.Service<Actor, string>()("@test/PlatformActor") {}

const runtime = makePlatformRuntime(DatabaseLive);
const adapter = makeEffectTRPC({ runtime });
const t = initTRPC.context<CallerOptions>().create();
const procedure = adapter.procedure(
	t.procedure,
	makeRequestServices((context: CallerOptions) =>
		Layer.succeed(Actor, context.actor),
	),
);
const router = t.router({
	createUser: procedure
		.input(
			Schema.Struct({
				email: Schema.String,
				id: Schema.String,
				name: Schema.String,
			}),
		)
		.mutation(function* (input) {
			const db = yield* Database;
			const actor = yield* Actor;
			return yield* db.User.create({
				...input,
				name: `${actor}:${input.name}`,
			});
		}),
	findUser: procedure.input(Schema.String).query(function* (id) {
		const db = yield* Database;
		return Option.getOrNull(yield* db.User.where({ id }).first());
	}),
});

const it = makePlatformIt(Database)({
	adapter,
	createCaller: (options = { actor: "default" }) =>
		router.createCaller(options),
	layer: DatabaseLive,
	extend: ({ db }) =>
		Effect.succeed({
			factories: {
				user: (name: string) => {
					const id = crypto.randomUUID();
					return {
						email: `${id}@example.test`,
						id,
						name,
					};
				},
			},
			userExists: (id: string) => db.User.where({ id }).exists(),
		}),
});

const integrationOptions = { skip: databaseUrl === undefined };
const rolledBackId = crypto.randomUUID();
const failedId = crypto.randomUUID();

afterAll(() => runtime.dispose());

it.effectApp(
	"shares one transaction across the caller, database, and application harness",
	function* ({ db, factories, trpc, userExists }, context) {
		expect(context.task.name).toContain("shares one transaction");
		const input = { ...factories.user("Ada"), id: rolledBackId };

		const created = yield* trpc.createUser(input);

		expect(created.name).toBe("default:Ada");
		expect(yield* userExists(created.id)).toBe(true);
		expect(
			Option.getOrThrow(yield* db.User.where({ id: created.id }).first()).email,
		).toBe(input.email);
	},
	integrationOptions,
);

it.effectApp(
	"rolls back successful tests",
	function* ({ trpc, userExists }) {
		expect(yield* userExists(rolledBackId)).toBe(false);
		expect(yield* trpc.findUser(rolledBackId)).toBeNull();
	},
	integrationOptions,
);

it.effectApp(
	"creates callers for another actor without rebuilding the test Layer",
	function* ({ factories, trpc }) {
		const input = factories.user("Grace");
		const created = yield* trpc({ actor: "admin" }).createUser(input);

		expect(created.name).toBe("admin:Grace");
	},
	integrationOptions,
);

it.effectApp.fails(
	"rolls back expected failures",
	function* ({ db, factories }) {
		const input = { ...factories.user("Failed"), id: failedId };
		yield* db.User.create(input);
		return yield* Effect.fail("expected failure");
	},
	integrationOptions,
);

it.effectApp(
	"does not retain writes from an expected failure",
	function* ({ userExists }) {
		expect(yield* userExists(failedId)).toBe(false);
	},
	integrationOptions,
);
