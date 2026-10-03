export class ControlledResult<Row> implements PromiseLike<Row[]>, AsyncIterable<Row> {
	private readonly execute: () => Promise<Row[]>;

	constructor(execute: () => Promise<Row[]>) {
		this.execute = execute;
	}

	then<TResult1 = Row[], TResult2 = never>(
		onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
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

export class FakeResult<Row> implements PromiseLike<Row[]>, AsyncIterable<Row> {
	private readonly rows: readonly Row[];

	constructor(rows: readonly Row[]) {
		this.rows = rows;
	}

	then<TResult1 = Row[], TResult2 = never>(
		onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return Promise.resolve([...this.rows]).then(onfulfilled, onrejected);
	}

	async *[Symbol.asyncIterator](): AsyncIterator<Row> {
		for (const row of this.rows) {
			yield row;
		}
	}
}

export class ControlledCollection<Row> {
	private readonly execute: () => Promise<Row[]>;

	constructor(execute: () => Promise<Row[]>) {
		this.execute = execute;
	}

	all(): ControlledResult<Row> {
		return new ControlledResult(this.execute);
	}

	first(): Promise<Row | null> {
		return this.execute().then((rows) => rows[0] ?? null);
	}
}

class EventStreamResult<Row> implements PromiseLike<Row[]>, AsyncIterable<Row> {
	private readonly rows: readonly Row[];
	private readonly events: string[];

	constructor(rows: readonly Row[], events: string[]) {
		this.rows = rows;
		this.events = events;
	}

	then<TResult1 = Row[], TResult2 = never>(
		onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
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
	private readonly rows: readonly Row[];
	private readonly events: string[];

	constructor(rows: readonly Row[], events: string[]) {
		this.rows = rows;
		this.events = events;
	}

	all(): EventStreamResult<Row> {
		return new EventStreamResult(this.rows, this.events);
	}
}
