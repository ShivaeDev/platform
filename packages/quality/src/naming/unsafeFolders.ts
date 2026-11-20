const ADAPTERS = /(?:^|\/)adapters\//u;

const TEST_SUPPORT = /(?:^|\/)test-support\//u;

export function inAdapters(path: string): boolean {
	return ADAPTERS.test(path);
}

export function inTestSupport(path: string): boolean {
	return TEST_SUPPORT.test(path);
}

export function inAdaptersOrTestSupport(path: string): boolean {
	return inAdapters(path) || inTestSupport(path);
}
