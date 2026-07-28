#!/usr/bin/env bash
set -euo pipefail

: "${GHCR_USERNAME:?GHCR_USERNAME is required}"
: "${GHCR_READ_TOKEN:?GHCR_READ_TOKEN is required}"
: "${IMAGE:?IMAGE is required}"

if [[ ! "$IMAGE" =~ ^ghcr\.io/.+:sha-[0-9a-f]{40}$ ]]; then
  echo "IMAGE must be an immutable ghcr.io tag containing a full 40-character commit SHA." >&2
  exit 1
fi

image_path="${IMAGE#ghcr.io/}"
repository="${image_path%:*}"
repository="${repository,,}"
tag="${image_path##*:}"
netrc_file="$(mktemp)"
token_file="$(mktemp)"

cleanup() {
  rm -f "$netrc_file" "$token_file"
}
trap cleanup EXIT

chmod 600 "$netrc_file" "$token_file"
printf 'machine ghcr.io login %s password %s\n' \
  "$GHCR_USERNAME" "$GHCR_READ_TOKEN" > "$netrc_file"

curl \
  --fail \
  --silent \
  --show-error \
  --netrc-file "$netrc_file" \
  --get \
  --data-urlencode "service=ghcr.io" \
  --data-urlencode "scope=repository:${repository}:pull" \
  "https://ghcr.io/token" > "$token_file"

registry_token="$(
  python3 - "$token_file" <<'PY'
import json
import pathlib
import sys

payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
token = payload.get("token") or payload.get("access_token")
if not token:
    raise SystemExit("GHCR did not return a registry token")
print(token)
PY
)"

curl \
  --fail \
  --silent \
  --show-error \
  --header "Authorization: Bearer ${registry_token}" \
  --header "Accept: application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json" \
  --output /dev/null \
  "$(
    if [[ "${GHCR_VERIFY_REPOSITORY_ONLY:-false}" == "true" ]]; then
      printf 'https://ghcr.io/v2/%s/tags/list?n=1' "$repository"
    else
      printf 'https://ghcr.io/v2/%s/manifests/%s' "$repository" "$tag"
    fi
  )"

if [[ "${GHCR_VERIFY_REPOSITORY_ONLY:-false}" == "true" ]]; then
  echo "GHCR read credential verified for repository ${repository}."
else
  echo "GHCR read credential verified for ${repository}:${tag}."
fi
