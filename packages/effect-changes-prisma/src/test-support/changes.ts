import { Effect } from "effect";
import type { Observation } from "@shivaedev/effect-changes/observe.ts";
import { makePrismaChanges } from "#changes.ts";
import type { ChangeMap } from "#model.ts";
import type { PrismaClient } from "#test/generated/client.ts";
import type { UnnamedWrite } from "#write.ts";

export interface Change {
	readonly domain: string;
	readonly subject: string;
}

export const models = {
	AuditNote: null,
	Invoice: (invoice) => [{ domain: "invoices", subject: invoice.ownerId }],
	Membership: (membership) => [
		{ domain: "memberships", subject: membership.ownerId },
		{ domain: "memberships", subject: membership.memberId },
	],
	Order: (order) => [{ domain: "orders", subject: order.ownerId }],
} satisfies ChangeMap<PrismaClient, Change>;

export const label = (change: Change) => `${change.subject}:${change.domain}`;

export const makeChanges = (client: PrismaClient, publish?: (changes: readonly Change[]) => Effect.Effect<void>) => {
	const published: (readonly string[])[] = [];
	const observations: Observation<Change>[] = [];
	const unnamed: UnnamedWrite[] = [];
	const changes = makePrismaChanges({
		client,
		key: label,
		models,
		name: "TestChanges",
		publish: (batch: readonly Change[]) =>
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
	return { changes, observations, observe, published, unnamed };
};
