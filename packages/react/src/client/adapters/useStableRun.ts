import { useInsertionEffect, useRef, useState } from "react";

// A deliberate swap changes `run` once and commits; React itself stops a component after 25 uncommitted renders without naming the hook.
const UNCOMMITTED_CHANGES = 10;

export function useStableRun(run: unknown) {
	// State, unlike a ref, is discarded with an abandoned render, so only renders React repeats before one commit are counted.
	const [seen, see] = useState({ changes: 0, run });
	const committedRef = useRef(seen);
	useInsertionEffect(() => {
		committedRef.current = seen;
	}, [seen]);
	if (seen.run === run) {
		return;
	}
	const changes = seen === committedRef.current ? 1 : seen.changes + 1;
	if (changes === UNCOMMITTED_CHANGES) {
		throw new Error(
			`useAction received a new \`run\` function on ${UNCOMMITTED_CHANGES} renders in a row. \`run\` is the action's identity and must stay the same function between renders: pass a bound command such as \`api.rename\` directly, or wrap your \`run\` in \`useCallback\` or \`useMemo\`.`,
		);
	}
	see({ changes, run });
}
