export const BUCKET_WRITE_POSTGRES_VERSION = 18;

export function supportsBucketWrites(serverVersionNum: number) {
	return serverVersionNum >= BUCKET_WRITE_POSTGRES_VERSION * 10_000;
}
