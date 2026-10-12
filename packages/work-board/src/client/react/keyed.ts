export function keyed<A>(values: readonly A[], identity: (value: A) => string) {
	const counts = new Map<string, number>();
	return values.map((value, index) => {
		const id = identity(value);
		const count = counts.get(id) ?? 0;
		counts.set(id, count + 1);
		return { index, key: `${id}:${count}`, value };
	});
}
