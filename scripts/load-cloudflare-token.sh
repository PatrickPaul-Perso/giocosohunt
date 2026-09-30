# À charger avec : source scripts/load-cloudflare-token.sh
# Nécessite Bash. Les valeurs restent dans le shell courant et ne sont pas écrites sur disque.

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

if ! IFS= read -r -p 'ID du compte Cloudflare : ' CLOUDFLARE_ACCOUNT_ID; then
  printf 'Lecture de l’ID du compte annulée.\n' >&2
  unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
  return 1
fi

if [[ -z "$CLOUDFLARE_ACCOUNT_ID" ]]; then
  printf 'Aucun ID de compte saisi.\n' >&2
  unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
  return 1
fi

export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
printf 'Identifiants chargés dans le terminal courant.\n'
