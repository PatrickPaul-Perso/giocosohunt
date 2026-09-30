# À charger avec : source scripts/load-cloudflare-token.sh
# Nécessite Bash. La valeur reste dans le shell courant et n'est pas écrite sur disque.

if [ -z "${BASH_VERSION:-}" ]; then
  printf 'Ce fichier doit être chargé dans Bash.\n' >&2
  return 1 2>/dev/null || exit 1
fi

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  printf 'Chargez ce fichier avec : source scripts/load-cloudflare-token.sh\n' >&2
  exit 1
fi

if ! IFS= read -r -s -p 'Jeton API Cloudflare : ' CLOUDFLARE_API_TOKEN; then
  printf '\nLecture du jeton annulée.\n' >&2
  unset CLOUDFLARE_API_TOKEN
  return 1
fi
printf '\n'

if [[ -z "$CLOUDFLARE_API_TOKEN" ]]; then
  printf 'Aucun jeton saisi.\n' >&2
  unset CLOUDFLARE_API_TOKEN
  return 1
fi

export CLOUDFLARE_API_TOKEN
printf 'Jeton chargé dans le terminal courant.\n'
