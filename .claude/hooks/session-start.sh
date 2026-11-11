#!/usr/bin/env bash
# Prepares a Claude Code cloud session to run this repository's checks. The repository states every version it needs,
# so the cloud environment stays generic and never needs an update when a version moves:
#   Node           .node-version
#   PostgreSQL     the image tag and server URL in packages/local-postgres/src/server/adapters/localContainer.ts and localPostgres.ts
# Every step skips work that is already done, so a resumed or cached session starts in seconds.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

# A session can start this hook twice at once, from user settings and from the repository's. The second run waits for the first
# and then finds everything in place, so two runs never race on apt, the cluster or pnpm. Commands that start a daemon close
# the lock's descriptor (9>&-), or the daemon would keep the lock after this script exits.
exec 9>/var/lock/platform-session-start.lock
flock -w 540 9 || { echo "session-start: another run still holds the lock after 540 seconds" >&2; exit 1; }

# A stalled network must fail the step, not hold the session start for the hook's whole timeout.
curlOptions=(-fsSL --connect-timeout 15 --max-time 300 --retry 3 --retry-delay 2)
exportOnce() {
  if [ -n "${CLAUDE_ENV_FILE:-}" ] && ! grep -qxF "$1" "$CLAUDE_ENV_FILE" 2>/dev/null; then
    echo "$1" >>"$CLAUDE_ENV_FILE"
  fi
}
waitForPostgres() {
  for _ in $(seq 120); do
    pg_isready -q -h 127.0.0.1 -p "$port" && return 0
    sleep 0.5
  done
  echo "session-start: PostgreSQL did not accept connections within 60 seconds" >&2
  return 1
}

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
fresh=false

# --- Node: the version in .node-version, installed beside the system Node and put first on PATH ---
want="$(tr -d 'v \n' <.node-version)"
case "$(uname -m)" in aarch64 | arm64) arch=arm64 ;; *) arch=x64 ;; esac
if [ "$(printf '%s' "$want" | tr -cd . | wc -c)" -lt 2 ]; then
  want="$(curl "${curlOptions[@]}" https://nodejs.org/dist/index.json | python3 -I -c '
import json, sys
prefix = "v" + sys.argv[1] + "."
print(next(r["version"] for r in json.load(sys.stdin) if (r["version"] + ".").startswith(prefix) or r["version"] == "v" + sys.argv[1])[1:])
' "$want")"
fi
nodeHome="/opt/node-$want"
if [ ! -x "$nodeHome/bin/node" ]; then
  tmp="$(mktemp -d)"
  archive="node-v$want-linux-$arch.tar.xz"
  curl "${curlOptions[@]}" -o "$tmp/$archive" "https://nodejs.org/dist/v$want/$archive"
  curl "${curlOptions[@]}" -o "$tmp/SHASUMS256.txt" "https://nodejs.org/dist/v$want/SHASUMS256.txt"
  (cd "$tmp" && grep " $archive\$" SHASUMS256.txt | sha256sum --check --status)
  tar -xJf "$tmp/$archive" -C "$tmp"
  rm -rf "$nodeHome"
  mv "$tmp/node-v$want-linux-$arch" "$nodeHome"
  rm -rf "$tmp"
fi
export PATH="$nodeHome/bin:$PATH"
# Written here, not at the end, so a later failure still leaves the session on the pinned Node.
exportOnce "export PATH=\"$nodeHome/bin:\$PATH\""
if ! command -v pnpm >/dev/null; then
  # Node 25 and newer ship no corepack, so install the pnpm that package.json pins.
  timeout 300 npm install -g "pnpm@$(sed -n 's/.*"packageManager": "pnpm@\([^+"]*\).*/\1/p' package.json)"
fi

# --- PostgreSQL: the major and minor of the pinned image, served on the port local setup expects ---
tag="$(sed -n 's/.*"postgres:\([0-9][0-9.]*\)-alpine.*/\1/p' packages/local-postgres/src/server/adapters/localContainer.ts | head -1)"
url="$(sed -n 's/.*LOCAL_SERVER = "\([^"]*\)".*/\1/p' packages/local-postgres/src/server/localPostgres.ts | head -1)"
major="${tag%%.*}"
port="${url##*:}"
password="$(printf '%s' "$url" | sed -n 's#^postgresql://[^:]*:\([^@]*\)@.*#\1#p')"
if [ -z "$tag" ] || [ -z "$port" ] || [ -z "$password" ]; then
  echo "session-start: cannot read the PostgreSQL pin from local-postgres; update $0" >&2
  exit 1
fi
if [ ! -x "/usr/lib/postgresql/$major/bin/postgres" ]; then
  if [ ! -f /etc/apt/sources.list.d/pgdg.list ]; then
    install -d /etc/apt/keyrings
    command -v gpg >/dev/null || DEBIAN_FRONTEND=noninteractive timeout 300 apt-get install -y -qq gnupg
    curl "${curlOptions[@]}" -o /tmp/pgdg.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
    # The published PGDG signing key; refuse any other key.
    if ! gpg --show-keys --with-colons /tmp/pgdg.asc | grep -q '^fpr:::::::::B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8:'; then
      echo "session-start: the PGDG key does not have the expected fingerprint" >&2
      rm -f /tmp/pgdg.asc
      exit 1
    fi
    mv /tmp/pgdg.asc /etc/apt/keyrings/pgdg.asc
    echo "deb [signed-by=/etc/apt/keyrings/pgdg.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" >/etc/apt/sources.list.d/pgdg.list
  fi
  aptOptions=(-o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30)
  timeout 300 apt-get "${aptOptions[@]}" update -qq
  # The pinned release when PGDG still serves it, otherwise the newest release of the same major version.
  exact="$(apt-cache madison "postgresql-$major" | awk -v prefix="$tag-" 'index($3, prefix) == 1 { print $3; exit }')"
  if [ -n "$exact" ]; then
    DEBIAN_FRONTEND=noninteractive timeout 400 apt-get "${aptOptions[@]}" install -y -qq "postgresql-$major=$exact" "postgresql-client-$major=$exact"
  else
    echo "session-start: PostgreSQL $tag is gone from PGDG; installing the newest $major.x, which local setup may refuse" >&2
    DEBIAN_FRONTEND=noninteractive timeout 400 apt-get "${aptOptions[@]}" install -y -qq "postgresql-$major"
  fi
fi
if ! pg_lsclusters --no-header | awk -v major="$major" -v port="$port" '$1 == major && $3 == port { found = 1 } END { exit !found }'; then
  pg_dropcluster "$major" main 2>/dev/null || true
  pg_createcluster "$major" main --port "$port" --locale C.UTF-8 --encoding UTF8
  printf "listen_addresses = '127.0.0.1'\nmax_connections = 300\nssl = off\n" >>"/etc/postgresql/$major/main/postgresql.conf"
  pg_ctlcluster "$major" main start 9>&-
  waitForPostgres
  su postgres -c "psql -p $port -qc \"ALTER USER postgres PASSWORD '$password'\""
  fresh=true
fi
pg_ctlcluster "$major" main status >/dev/null 2>&1 || pg_ctlcluster "$major" main start 9>&-
waitForPostgres

# --- Dependencies, the pre-commit hook and the databases, only when an input of theirs has changed ---
hashes=node_modules/.session-start.sha256
inputs=(.claude/hooks/session-start.sh .node-version package.json pnpm-lock.yaml pnpm-workspace.yaml)
if [ "$fresh" = true ] || [ ! -f .git/hooks/pre-commit ] || ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  ./script/update
  sha256sum "${inputs[@]}" >"$hashes"
fi

# --- Test database URLs, so a focused PostgreSQL spec runs instead of skipping ---
while IFS= read -r line; do exportOnce "$line"; done < <(pnpm --silent run test:environment | grep "^export ")
