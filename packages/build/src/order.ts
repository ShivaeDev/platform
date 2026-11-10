// Code-unit order, so output is the same on every machine, unlike localeCompare.
export function byText(left: string, right: string): number {
	if (left < right) {
		return -1;
	}
	return left > right ? 1 : 0;
}
