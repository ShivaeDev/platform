export const captureStackTrace = (): (() => string | undefined) => {
	const limit = Error.stackTraceLimit;
	Error.stackTraceLimit = 3;
	const traceError = new Error();
	Error.stackTraceLimit = limit;

	let cache: false | string = false;
	return () => {
		if (cache !== false) {
			return cache;
		}
		const frame = traceError.stack?.split("\n")[3];
		if (frame !== undefined) {
			cache = frame.trim();
			return cache;
		}
		return undefined;
	};
};
