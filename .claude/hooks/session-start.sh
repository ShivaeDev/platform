#!/usr/bin/env bash
# Prepares a Claude Code cloud session to run this repository's checks. The repository states every version it needs,
# so the cloud environment stays generic and never needs an update when a version moves:
#   Node           .node-version
#   PostgreSQL     the image tag and server URL in packages/local-postgres/src/server/adapters/localContainer.ts and localPostgres.ts
# Every step skips work that is already done, so a resumed or cached session starts in seconds.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
fresh=false

# --- Node: the version in .node-version, installed beside the system Node and put first on PATH ---
want="$(tr -d 'v \n' <.node-version)"
case "$(uname -m)" in aarch64 | arm64) arch=arm64 ;; *) arch=x64 ;; esac
if [ "$(printf '%s' "$want" | tr -cd . | wc -c)" -lt 2 ]; then
  want="$(curl -fsSL https://nodejs.org/dist/index.json | python3 -I -c '
import json, sys
prefix = "v" + sys.argv[1] + "."
print(next(r["version"] for r in json.load(sys.stdin) if (r["version"] + ".").startswith(prefix) or r["version"] == "v" + sys.argv[1])[1:])
' "$want")"
fi
nodeHome="/opt/node-$want"
if [ ! -x "$nodeHome/bin/node" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL "https://nodejs.org/dist/v$want/node-v$want-linux-$arch.tar.xz" | tar -xJ -C "$tmp"
  rm -rf "$nodeHome"
  mv "$tmp/node-v$want-linux-$arch" "$nodeHome"
  rmdir "$tmp"
fi
export PATH="$nodeHome/bin:$PATH"
if ! command -v pnpm >/dev/null; then
  # Node 25 and newer ship no corepack, so install the pnpm that package.json pins.
  npm install -g "pnpm@$(sed -n 's/.*"packageManager": "pnpm@\([^+"]*\).*/\1/p' package.json)"
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
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /etc/apt/keyrings/pgdg.asc
    echo "deb [signed-by=/etc/apt/keyrings/pgdg.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo "$VERSION_CODENAME")-pgdg main" >/etc/apt/sources.list.d/pgdg.list
  fi
  apt-get update -qq
  # The pinned release when PGDG still serves it, otherwise the newest release of the same major version.
  exact="$(apt-cache madison "postgresql-$major" | awk -v prefix="$tag-" 'index($3, prefix) == 1 { print $3; exit }')"
  if [ -n "$exact" ]; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "postgresql-$major=$exact" "postgresql-client-$major=$exact"
  else
    echo "session-start: PostgreSQL $tag is gone from PGDG; installing the newest $major.x, which local setup may refuse" >&2
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "postgresql-$major"
  fi
fi
if ! pg_lsclusters --no-header | awk -v major="$major" -v port="$port" '$1 == major && $3 == port { found = 1 } END { exit !found }'; then
  pg_dropcluster "$major" main 2>/dev/null || true
  pg_createcluster "$major" main --port "$port" --locale C.UTF-8 --encoding UTF8
  printf "listen_addresses = '127.0.0.1'\nmax_connections = 300\nssl = off\n" >>"/etc/postgresql/$major/main/postgresql.conf"
  pg_ctlcluster "$major" main start
  until pg_isready -q -h 127.0.0.1 -p "$port"; do sleep 0.5; done
  su postgres -c "psql -p $port -qc \"ALTER USER postgres PASSWORD '$password'\""
  fresh=true
fi
pg_ctlcluster "$major" main status >/dev/null 2>&1 || pg_ctlcluster "$major" main start
until pg_isready -q -h 127.0.0.1 -p "$port"; do sleep 0.5; done

# --- Dependencies, the pre-commit hook and the databases, only when an input of theirs has changed ---
hashes=node_modules/.session-start.sha256
inputs=(.claude/hooks/session-start.sh .node-version package.json pnpm-lock.yaml pnpm-workspace.yaml)
if [ "$fresh" = true ] || [ ! -f .git/hooks/pre-commit ] || ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  ./script/update
  sha256sum "${inputs[@]}" >"$hashes"
fi

# --- Every session: the Node chosen above ---
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$nodeHome/bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
fi
