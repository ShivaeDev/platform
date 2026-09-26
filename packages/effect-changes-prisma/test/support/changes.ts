import type { Observation } from "@shivaedev/effect-changes";
import { Effect } from "effect";
import { type ChangeMap, makePrismaChanges, type UnnamedWrite } from "../../src/index.ts";
import type { PrismaClient } from "../generated/client.ts";

export interface Change {
	readonly subject: string;
	readonly domain: string;
}

export const models = {
	Order: (order) => [{ subject: order.ownerId, domain: "orders" }],
	Membership: (membership) => [
		{ subject: membership.ownerId, domain: "memberships" },
		{ subject: membership.memberId, domain: "memberships" },
	],
	Invoice: (invoice) => [{ subject: invoice.ownerId, domain: "invoices" }],
	AuditNote: null,
} satisfies ChangeMap<PrismaClient, Change>;

export const label = (change: Change) => `${change.subject}:${change.domain}`;

export const makeChanges = (client: PrismaClient, publish?: (changes: ReadonlyArray<Change>) => Effect.Effect<void>) => {
	const published: Array<ReadonlyArray<string>> = [];
	const observations: Array<Observation<Change>> = [];
	const unnamed: Array<UnnamedWrite> = [];
	const changes = makePrismaChanges({
		name: "TestChanges",
		client,
		models,
		key: label,
		publish: (batch: ReadonlyArray<Change>) =>
			Effect.andThen(
				Effect.sync(() => published.push(batch.map(label))),
				publish === undefined ? Effect.void : publish(batch),
			),
	});
	const observe = <X, E, R>(effect: Effect.Effect<X, E, R>) =>
		effect.pipe(
			Effect.provideService(changes.channel.Observer, (observation: Observation<Change>) => Effect.sync(() => observations.push(observation))),
			Effect.provideService(changes.Unnamed, (write: UnnamedWrite) => Effect.sync(() => unnamed.push(write))),
		);
	return { changes, published, observations, unnamed, observe };
};
