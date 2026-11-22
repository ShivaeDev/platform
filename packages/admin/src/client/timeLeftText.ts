import { Duration } from "effect";

export function timeLeftText(timeLeft: Duration.Duration): string {
	if (!Duration.isGreaterThan(timeLeft, Duration.zero)) {
		return "past deadline";
	}
	return `${Duration.format(Duration.seconds(Math.ceil(Duration.toSeconds(timeLeft))))} left`;
}
