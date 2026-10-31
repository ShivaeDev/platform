import type { Job, PgBoss, SendOptions } from "pg-boss";

export function testingExpirations(client: PgBoss) {
	const snapshots = new Map<string, Promise<number | undefined>>();
	return {
		attemptsFor: (job: Job<unknown>) => snapshots.get(`${job.name}:${job.id}`),
		send(name: string, data: object | null | undefined, options: SendOptions, attempts: number | undefined) {
			if (attempts === undefined && options.id === undefined) {
				return client.send(name, data, options);
			}
			const id = options.id ?? crypto.randomUUID();
			const key = `${name}:${id}`;
			const previous = snapshots.get(key);
			const sending = client.send(name, data, { ...options, id });
			// A worker may claim the row before send returns. Wait for its result before applying the snapshot.
			const snapshot = sending
				.then(
					(sent) => (sent === id ? attempts : previous),
					() => previous,
				)
				.then((value) => {
					if (value === undefined && snapshots.get(key) === snapshot) {
						snapshots.delete(key);
					}
					return value;
				});
			snapshots.set(key, snapshot);
			return sending;
		},
	};
}
