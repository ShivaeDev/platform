export function requireSetup(condition: boolean, message: string): void {
	if (!condition) {
		throw new Error(message);
	}
}
