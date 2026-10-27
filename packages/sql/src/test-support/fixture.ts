export function fixture<A>() {
	let value: A | undefined;
	return {
		get: (): A => {
			if (value === undefined) {
				throw new Error("The story needs a trait that creates this fixture");
			}
			return value;
		},
		peek: () => value,
		set: (next: A) => {
			value = next;
		},
	};
}
