import { Duration, Effect } from "effect";
import { useEffect, useState } from "react";
import { clockEffect } from "#client/react/adapters/clockEffect.ts";
import { useBoardClock } from "#client/react/FormContext.ts";

export function useSearchText(input: string): readonly [string, (text: string) => void] {
	const clock = useBoardClock();
	const [text, setText] = useState(() => input.trim());
	useEffect(() => clockEffect(clock.sleep(Duration.millis(150)).pipe(Effect.andThen(Effect.sync(() => setText(input.trim()))))), [clock, input]);
	return [text, setText] as const;
}
