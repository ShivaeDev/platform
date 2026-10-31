import { act } from "react";

// React holds the work it schedules inside an async act scope until the scope ends, so a wait for a commit inside act cannot see that commit.
export async function screenAct(action: () => Promise<void>) {
	const environment: unknown = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": false });
	try {
		await action();
	} finally {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": environment });
	}
	await act(() => Promise.resolve());
}
