export class ControlledResult<Row>
	implements PromiseLike<Array<Row>>, AsyncIterable<Row>
{
	constructor(private readonly execute: () => Promise<Array<Row>>) {}

	// biome-ignore lint/suspicious/noThenProperty: This test double intentionally matches Prisma's PromiseLike result.
	then<TResult1 = Array<Row>, TResult2 = never>(
		onfulfilled?:
			| ((value: Array<Row>) => TResult1 | PromiseLike<TResult1>)
			| null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(onfulfilled, onrejected);
	}

	async *[Symbol.asyncIterator](): AsyncIterator<Row> {
		for (const row of await this.execute()) {
			yield row;
		}
	}
}

export class ControlledCollection<Row> {
	constructor(private readonly execute: () => Promise<Array<Row>>) {}

	all(): ControlledResult<Row> {
		return new ControlledResult(this.execute);
	}

	first(): Promise<Row | null> {
		return this.execute().then((rows) => rows[0] ?? null);
	}
}

class EventStreamResult<Row>
	implements PromiseLike<Array<Row>>, AsyncIterable<Row>
{
	constructor(
		private readonly rows: ReadonlyArray<Row>,
		private readonly events: Array<string>,
	) {}

	// biome-ignore lint/suspicious/noThenProperty: This test double intentionally matches Prisma's PromiseLike result.
	then<TResult1 = Array<Row>, TResult2 = never>(
		onfulfilled?:
			| ((value: Array<Row>) => TResult1 | PromiseLike<TResult1>)
			| null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return Promise.resolve([...this.rows]).then(onfulfilled, onrejected);
	}

	async *[Symbol.asyncIterator](): AsyncIterator<Row> {
		this.events.push("source:start");
		try {
			for (const row of this.rows) {
				yield row;
			}
		} finally {
			this.events.push("source:end");
		}
	}
}

export class EventStreamCollection<Row> {
	constructor(
		private readonly rows: ReadonlyArray<Row>,
		private readonly events: Array<string>,
	) {}

	all(): EventStreamResult<Row> {
		return new EventStreamResult(this.rows, this.events);
	}
}
