import { STATELY_DEFERRAL_POLICY } from "#internal/deferral.ts";
import { quotedSchema } from "#internal/storedRows.ts";

export function deferralStorePlan(schema: string): string {
	const quoted = quotedSchema(schema);
	const jobTable = `${quoted}.job`.replaceAll("'", "''");
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
		CREATE OR REPLACE FUNCTION ${quoted}.effect_stately_deferral() RETURNS trigger LANGUAGE plpgsql AS $claim$
		BEGIN
			IF NEW.policy = '${STATELY_DEFERRAL_POLICY}' AND NEW.state = 'active' THEN
				NEW.policy := 'stately';
			END IF;
			RETURN NEW;
		END
		$claim$;
		IF NOT EXISTS (
			SELECT 1 FROM pg_trigger WHERE tgrelid = '${jobTable}'::regclass AND tgname = 'effect_stately_deferral'
		) THEN
			CREATE TRIGGER effect_stately_deferral BEFORE UPDATE OF state, policy ON ${quoted}.job
			FOR EACH ROW EXECUTE FUNCTION ${quoted}.effect_stately_deferral();
		END IF;
	END`;
	return `DO '${body.replaceAll("'", "''")}'`;
}
