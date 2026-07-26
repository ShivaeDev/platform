import { it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { expect } from "vitest";
import type { AnyPostgresContract } from "../src/internal/executor.js";
import {
	releaseTestTransaction,
	releaseTransaction,
	type TransactionResource,
} from "../src/internal/transaction.js";

interface ResourceOptions {
	readonly commitFailure?: unknown;
	readonly releaseFailure?: unknown;
	readonly rollbackFailure?: unknown;
}

const makeResource = (options: ResourceOptions = {}) => {
	const calls: Array<string> = [];
	const resource = {
		connection: {
			destroy: async () => {
				calls.push("destroy");
			},
			release: async () => {
				calls.push("release");
				if (options.releaseFailure !== undefined) {
					throw options.releaseFailure;
				}
			},
		},
		transaction: {
			commit: async () => {
				calls.push("commit");
				if (options.commitFailure !== undefined) {
					throw options.commitFailure;
				}
			},
			rollback: async () => {
				calls.push("rollback");
				if (options.rollbackFailure !== undefined) {
					throw options.rollbackFailure;
				}
			},
		},
	} as unknown as TransactionResource<
		Record<string, never>,
		AnyPostgresContract
	>;

	return { calls, resource };
};

it.effect("commits and releases a successful transaction", () =>
	Effect.gen(function* () {
		const { calls, resource } = makeResource();

		yield* releaseTransaction(resource, Exit.succeed(undefined));

		expect(calls).toEqual(["commit", "release"]);
	}),
);

it.effect("rolls back and releases a failed transaction", () =>
	Effect.gen(function* () {
		const { calls, resource } = makeResource();

		yield* releaseTransaction(resource, Exit.fail("expected"));

		expect(calls).toEqual(["rollback", "release"]);
	}),
);

it.effect("forces rollback for a successful test transaction", () =>
	Effect.gen(function* () {
		const { calls, resource } = makeResource();

		yield* releaseTestTransaction(resource, Exit.succeed(undefined));

		expect(calls).toEqual(["rollback", "release"]);
	}),
);

it.effect("reports commit failure after attempting rollback and release", () =>
	Effect.gen(function* () {
		const { calls, resource } = makeResource({
			commitFailure: new Error("commit failed"),
		});

		const error = yield* Effect.flip(
			releaseTransaction(resource, Exit.succeed(undefined)),
		);

		expect(calls).toEqual(["commit", "rollback", "release"]);
		expect(error.reason).toMatchObject({
			_tag: "PrismaRuntimeFailure",
			code: "RUNTIME.TRANSACTION_COMMIT_FAILED",
		});
	}),
);

it.effect("destroys the connection when rollback fails", () =>
	Effect.gen(function* () {
		const { calls, resource } = makeResource({
			rollbackFailure: new Error("rollback failed"),
		});

		const error = yield* Effect.flip(
			releaseTransaction(resource, Exit.fail("expected")),
		);

		expect(calls).toEqual(["rollback", "destroy"]);
		expect(error.reason).toMatchObject({
			_tag: "PrismaRuntimeFailure",
			code: "RUNTIME.TRANSACTION_ROLLBACK_FAILED",
		});
	}),
);

it.effect("destroys the connection when release fails", () =>
	Effect.gen(function* () {
		const releaseFailure = {
			code: "RUNTIME.CONNECTION_RELEASE_FAILED",
		};
		const { calls, resource } = makeResource({ releaseFailure });

		const error = yield* Effect.flip(
			releaseTransaction(resource, Exit.succeed(undefined)),
		);

		expect(calls).toEqual(["commit", "release", "destroy"]);
		expect(error.reason).toMatchObject({
			_tag: "PrismaRuntimeFailure",
			code: releaseFailure.code,
		});
	}),
);
