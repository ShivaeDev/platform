const marker = crypto.randomUUID();
export const queryUsers = ["one", "two", "three"].map((suffix) => ({
	email: `${marker}-${suffix}@example.test`,
	id: crypto.randomUUID(),
	name: marker,
}));
export const queryGroup = marker;
