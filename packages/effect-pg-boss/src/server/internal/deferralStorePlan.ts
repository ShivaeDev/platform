export function deferralStorePlan(schema: string): string {
	const quoted = `"${schema.replaceAll('"', '""')}"`;
	const key = `${schema}.effect_job_deferral`.replaceAll("'", "''");
	const body = `BEGIN
		PERFORM pg_advisory_xact_lock(hashtextextended('${key}', 0));
		CREATE TABLE IF NOT EXISTS ${quoted}.effect_job_deferral (
			name text NOT NULL,
			id uuid NOT NULL,
			created_on timestamptz NOT NULL,
			count bigint NOT NULL,
			keep_until timestamptz NOT NULL,
			PRIMARY KEY (name, id)
		);
		CREATE INDEX IF NOT EXISTS effect_job_deferral_keep_until ON ${quoted}.effect_job_deferral (keep_until);
	END`;
	return `DO '${body.replaceAll("'", "''")}'`;
}
