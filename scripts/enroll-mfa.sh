#!/usr/bin/env bash
# Registra el TOTP de un usuario privilegiado (AD-09) y comprueba T14.
# Uso: bash scripts/enroll-mfa.sh gestor
# El secreto TOTP se muestra una sola vez: no lo copies en capturas, chats ni archivos.
set -u
source "$(dirname "$0")/lib.sh"
load_stack
PROVISIONING=$(out ProvisioningClientId)

name=${1:?Indica el usuario, por ejemplo: gestor}
email="$name@aqp-solidaria.test"

read -rs -p "Contraseña de $email: " password
echo
params=$(jq -nc --arg u "$email" --arg p "$password" '{USERNAME:$u,PASSWORD:$p}')

auth() {
  aws cognito-idp initiate-auth --client-id "$PROVISIONING" \
    --auth-flow USER_PASSWORD_AUTH --auth-parameters "$params" --output json
}

resp=$(auth) || { echo "No se pudo iniciar sesión."; exit 1; }
if [ "$(echo "$resp" | jq -r '.ChallengeName // empty')" = "SOFTWARE_TOKEN_MFA" ]; then
  echo "$email ya tiene TOTP registrado."
else
  token=$(echo "$resp" | jq -r '.AuthenticationResult.AccessToken // empty')
  [ -n "$token" ] || { echo "Respuesta inesperada de Cognito."; exit 1; }
  secret=$(aws cognito-idp associate-software-token --access-token "$token" --query SecretCode --output text)
  echo
  echo "Agrega esta cuenta en tu app autenticadora, con ingreso manual:"
  echo "  Cuenta: AQP-SOLIDARIA ($name)"
  echo "  Clave:  $secret"
  echo
  read -r -p "Código de 6 dígitos que muestra la app: " code
  aws cognito-idp verify-software-token --access-token "$token" --user-code "$code" \
    --friendly-device-name authenticator --query Status --output text || exit 1
  aws cognito-idp set-user-mfa-preference --access-token "$token" \
    --software-token-mfa-settings Enabled=true,PreferredMfa=true || exit 1
  unset secret token code
fi

echo
echo "=== Verificación de AD-09"
aws cognito-idp admin-get-user --user-pool-id "$POOL" --username "$email" \
  --query '{usuario:Username,mfa:UserMFASettingList,preferido:PreferredMfaSetting}' --output json

echo
echo "=== T14: contraseña correcta, sin segundo factor"
resp=$(auth) || exit 1
unset password
echo "ChallengeName: $(echo "$resp" | jq -r '.ChallengeName // "ninguno"')"
if [ "$(echo "$resp" | jq -r '.AuthenticationResult // empty')" = "" ]; then
  echo "Tokens entregados: ninguno. T14 CUMPLIDA."
else
  echo "Tokens entregados: SÍ. T14 NO CUMPLIDA."
  exit 1
fi
