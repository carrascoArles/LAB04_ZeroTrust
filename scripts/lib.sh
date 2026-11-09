# Funciones comunes. Se ejecuta en AWS CloudShell, con la sesión del integrante.
# Los tokens viven solo en variables de este proceso: nunca se escriben en disco.

out() {
  aws cloudformation describe-stacks --stack-name "${STACK:-aqp-solidaria}" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

load_stack() {
  POOL=$(out UserPoolId)
  CLIENT=$(out UserPoolClientId)
  DOMAIN=$(out CognitoDomain)
  API=$(out ApiUrl)
  SPA=$(out SpaUrl)
  [ -n "$API" ] && [ "$API" != "None" ] || { echo "No se encontró la pila desplegada." >&2; exit 1; }
}

# Authorization Code + PKCE real. Deja ACCESS, ID y REFRESH con los tokens del usuario.
login() {
  local verifier challenge raw code resp
  verifier=$(openssl rand -base64 48 | tr -d '=+/\n' | cut -c1-64)
  challenge=$(printf %s "$verifier" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  echo
  echo "=== Login de $1@aqp-solidaria.test"
  echo "Cierra TODAS las ventanas privadas y abre una nueva: si no, Cognito reutiliza la sesión anterior."
  # prompt=login obliga a autenticarse aunque haya una sesión abierta en el navegador.
  echo "$DOMAIN/oauth2/authorize?response_type=code&client_id=$CLIENT&redirect_uri=$SPA/callback&scope=openid+email+api/projects.write+api/donations.write+api/donations.read+api/audit.read&code_challenge_method=S256&code_challenge=$challenge&prompt=login"
  echo "Sin frontend publicado verás un error de CloudFront: es normal. Copia la URL completa."
  read -r -p "Pega la URL aquí: " raw
  code=${raw##*code=}
  code=${code%%&*}
  resp=$(curl -s -X POST "$DOMAIN/oauth2/token" -H 'Content-Type: application/x-www-form-urlencoded' \
    -d grant_type=authorization_code -d "client_id=$CLIENT" -d "code=$code" \
    -d "redirect_uri=$SPA/callback" -d "code_verifier=$verifier")
  ACCESS=$(echo "$resp" | jq -r '.access_token // empty')
  ID=$(echo "$resp" | jq -r '.id_token // empty')
  REFRESH=$(echo "$resp" | jq -r '.refresh_token // empty')
  if [ -z "$ACCESS" ]; then
    echo "Login fallido: $(echo "$resp" | jq -r '.error // "sin detalle"')" >&2
    exit 1
  fi
  # Comprueba que la sesión sea del usuario esperado. Solo lee claims, no muestra el token.
  local email groups
  email=$(jwt_claim "$ID" '.email')
  groups=$(jwt_claim "$ACCESS" '."cognito:groups" // [] | join(",")')
  if [ "$email" != "$1@aqp-solidaria.test" ]; then
    echo "La sesión es de $email, no de $1@aqp-solidaria.test. Cierra todas las ventanas privadas y vuelve a ejecutar." >&2
    exit 1
  fi
  echo "OK: sesión de $email, grupos: $groups"
}

# jwt_claim TOKEN FILTRO_JQ: decodifica el payload (sin validar firma; solo para diagnóstico).
jwt_claim() {
  local p
  p=$(printf %s "$1" | cut -d. -f2 | tr '_-' '/+')
  while [ $(( ${#p} % 4 )) -ne 0 ]; do p="$p="; done
  printf %s "$p" | base64 -d 2>/dev/null | jq -r "$2"
}

# call TOKEN METODO RUTA CUERPO [opciones de curl]
call() {
  local token=$1 method=$2 path=$3 data=$4
  shift 4
  local args=(-s -w ' [%{http_code}]\n' -X "$method" "$API$path" -H 'content-type: application/json')
  [ -n "$token" ] && args+=(-H "authorization: Bearer $token")
  [ -n "$data" ] && args+=(-d "$data")
  curl "${args[@]}" "$@"
}

body() { sed 's/ \[[0-9]*\]$//'; }
