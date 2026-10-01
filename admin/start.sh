#!/bin/sh
set -eu
admin_runtime_dir="$(mktemp -d /tmp/giocoso-admin.XXXXXX)"
trap 'rm -rf "$admin_runtime_dir"' EXIT
sed 's#"./worker.ts"#"/app/admin/worker.ts"#' /app/admin/wrangler.jsonc > "$admin_runtime_dir/wrangler.jsonc"
node -e '
const fs = require("node:fs");
const path = process.argv[1];
const rows = [];
for (const key of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
  if (process.env[key]) rows.push(key + "=" + JSON.stringify(process.env[key]));
}
fs.writeFileSync(path, rows.join("\n") + "\n", { mode: 0o600 });
' "$admin_runtime_dir/.dev.vars"
npx wrangler dev --config "$admin_runtime_dir/wrangler.jsonc" --local --persist-to /app/.wrangler/state --ip 0.0.0.0 --port 8788
