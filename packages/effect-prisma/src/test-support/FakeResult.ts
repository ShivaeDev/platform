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
