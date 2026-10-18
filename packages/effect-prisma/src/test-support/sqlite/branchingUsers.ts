export const branchingUsers = ["active", "inactive", "active"].map((name) => {
	const id = crypto.randomUUID();
	return { email: `${id}@example.test`, id, name };
});
export const branchingRows = branchingUsers.map(({ id, name }) => ({ id, name }));
