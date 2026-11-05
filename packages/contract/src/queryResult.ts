import * as AsyncResult from "effect/reactivity/AsyncResult";

export function queryResult<A, E>(equivalent: (left: A, right: A) => boolean, publish: (value: AsyncResult.AsyncResult<A, E>) => void) {
	let settled: AsyncResult.Success<A, E> | undefined;
	return (value: AsyncResult.AsyncResult<A, E>) => {
		if (!AsyncResult.isSuccess(value)) {
			publish(value);
			return;
		}
		if (settled !== undefined && equivalent(settled.value, value.value)) {
			publish(value.waiting ? AsyncResult.waiting(settled) : settled);
			return;
		}
		if (!value.waiting) {
			settled = value;
		}
		publish(value);
	};
}
