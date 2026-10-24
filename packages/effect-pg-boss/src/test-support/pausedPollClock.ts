import { type Clock, TestClock } from "pg-boss";

export function pausedPollClock(): Clock {
	const clock = new TestClock();
	// Pause native polling, including its elapsed-cycle calculation. PostgreSQL and Effect's retry wake keep real time.
	// Omitting attach leaves pg-boss's database clock untouched.
	return {
		clearInterval: (handle) => clock.clearInterval(handle),
		clearTimeout: (handle) => clock.clearTimeout(handle),
		now: () => clock.now(),
		setInterval: (callback, ms) => clock.setInterval(callback, ms),
		setTimeout: (callback, ms) => clock.setTimeout(callback, ms),
	};
}
