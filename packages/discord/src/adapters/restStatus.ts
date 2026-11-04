import * as HttpStatus from "effect/http/HttpStatus";

export function isRateLimited(status: number) {
	return status === HttpStatus.fromLiteral("TooManyRequests");
}

export function isEmpty(status: number) {
	return status === HttpStatus.fromLiteral("NoContent");
}
