#!/usr/bin/env bash
# Crea los usuarios ficticios de la demo. Puede repetirse: solo actualiza la contraseña.
# Uso: bash scripts/create-test-users.sh
set -u
source "$(dirname "$0")/lib.sh"
load_stack

read -rs -p "Contraseña de prueba (12+, mayúscula, minúscula, número y símbolo): " password
echo
for entry in donante1:DONANTE donante2:DONANTE gestor:GESTOR auditor:AUDITOR; do
  name=${entry%%:*}
  group=${entry##*:}
  email="$name@aqp-solidaria.test"
  aws cognito-idp admin-create-user --user-pool-id "$POOL" --username "$email" \
    --user-attributes Name=email,Value="$email" Name=email_verified,Value=true \
    --message-action SUPPRESS >/dev/null 2>&1
  aws cognito-idp admin-set-user-password --user-pool-id "$POOL" --username "$email" \
    --password "$password" --permanent || { echo "Falló $email"; exit 1; }
  aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL" --username "$email" \
    --group-name "$group" || exit 1
  echo "OK $email -> $group"
done
unset password
echo
echo "Falta registrar el TOTP de los privilegiados: bash scripts/enroll-mfa.sh gestor y auditor"
