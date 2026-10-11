export function at<T>(values: ArrayLike<T>, index: number): T {
	const value = values[index];
	if (value === undefined) {
		throw new Error("Invalid reconciliation index");
	}
	return value;
}
