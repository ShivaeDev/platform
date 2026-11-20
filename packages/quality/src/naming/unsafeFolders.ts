const ADAPTERS = /(?:^|\/)adapters\//u;

const ADAPTERS_OR_TEST_SUPPORT = /(?:^|\/)(?:adapters|test-support)\//u;

export function inAdapters(path: string): boolean {
	return ADAPTERS.test(path);
}

export function inAdaptersOrTestSupport(path: string): boolean {
	return ADAPTERS_OR_TEST_SUPPORT.test(path);
}
