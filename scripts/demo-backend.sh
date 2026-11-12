#!/usr/bin/env bash
# Pruebas de aceptación contra el API desplegado, con llamadas directas y una pausa por prueba.
# Requiere scripts/create-test-users.sh. Uso: bash scripts/demo-backend.sh
set -u
source "$(dirname "$0")/lib.sh"
load_stack

step() {
  echo
  echo "=== $1"
  echo "    Esperado: $2"
  read -r -p "    [Enter para ejecutar] " _
}

login gestor;   TG=$ACCESS
login donante1; TD=$ACCESS; TD_ID=$ID; TD_REFRESH=$REFRESH
login donante2; TO=$ACCESS
login auditor;  TA=$ACCESS
echo
echo "Los cuatro inicios de sesión funcionaron."

step "T02: donar sin token" "401"
call "" POST /v1/donations '{}'

step "T11: token alterado" "401"
call "abc.def.ghi" GET /v1/donations/me ""

step "T11: ID token en lugar de access token" "rechazado (CA-03.2 pide 401; anota el código real)"
call "$TD_ID" GET /v1/donations/me ""

step "T03: un donante intenta crear un proyecto" "403"
call "$TD" POST /v1/projects '{"title":"x","description":"y","goalAmountCents":100}'

step "HU-08: el gestor crea y publica un proyecto" "201 y 200"
R=$(call "$TG" POST /v1/projects '{"title":"Comedor popular","description":"Raciones diarias","goalAmountCents":500000}')
echo "$R"
PROJECT=$(echo "$R" | body | jq -r .projectId)
call "$TG" PATCH "/v1/projects/$PROJECT/publish" ""

step "CA-08.2: publicar de nuevo" "409"
call "$TG" PATCH "/v1/projects/$PROJECT/publish" ""

step "T01: catálogo público, sin token" "200 con el proyecto"
call "" GET /v1/projects ""

step "T04: montos inválidos (0, 100001, 100.5)" "400 en los tres"
for m in 0 100001 100.5; do
  call "$TD" POST /v1/donations "{\"projectId\":\"$PROJECT\",\"amountCents\":$m}" -H "idempotency-key: $(uuidgen)"
done

step "CA-05.3: enviar donorSub en el cuerpo" "400"
call "$TD" POST /v1/donations "{\"projectId\":\"$PROJECT\",\"amountCents\":1000,\"donorSub\":\"otro\"}" -H "idempotency-key: $(uuidgen)"

step "T05 y T06: donación válida y reintento con la misma clave" "201 y 201 con el mismo donationId"
KEY=$(uuidgen)
R=$(call "$TD" POST /v1/donations "{\"projectId\":\"$PROJECT\",\"amountCents\":2500}" -H "idempotency-key: $KEY")
echo "$R"
DONATION=$(echo "$R" | body | jq -r .donationId)
call "$TD" POST /v1/donations "{\"projectId\":\"$PROJECT\",\"amountCents\":2500}" -H "idempotency-key: $KEY"

step "T07: misma clave con otro monto" "409"
call "$TD" POST /v1/donations "{\"projectId\":\"$PROJECT\",\"amountCents\":9999}" -H "idempotency-key: $KEY"

step "T09: otro donante consulta y simula esa donación" "404 y 404, sin datos"
call "$TO" GET "/v1/donations/$DONATION" ""
call "$TO" POST "/v1/donations/$DONATION/simulate" '{"outcome":"CONFIRMADA_SIMULADA"}'

step "T12: el gestor consulta un historial" "403"
call "$TG" GET /v1/donations/me ""

step "T08: 10 confirmaciones simultáneas" "un 200 y nueve 409"
for i in $(seq 10); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/v1/donations/$DONATION/simulate" \
    -H "authorization: Bearer $TD" -H 'content-type: application/json' \
    -d '{"outcome":"CONFIRMADA_SIMULADA"}' &
done | sort | uniq -c
wait

step "CA-09: acumulado del proyecto" "confirmedAmountCents = 2500"
call "" GET "/v1/projects/$PROJECT/stats" ""

step "HU-07: historial del propietario" "200 con su donación"
call "$TD" GET /v1/donations/me ""

step "HU-10: el auditor consulta eventos" "200 con actorRef seudonimizado"
call "$TA" GET "/v1/audit?eventType=DONATION_SIMULATED" ""

step "HU-10: un donante intenta consultar auditoría" "403"
call "$TD" GET "/v1/audit?eventType=DONATION_SIMULATED" ""

step "Throttling: ráfaga de 300 solicitudes al catálogo" "200 y, si supera el límite del stage, 429"
seq 300 | xargs -P 100 -I{} curl -s -o /dev/null -w '%{http_code}\n' "$API/v1/projects" | sort | uniq -c

step "T13: revocar el refresh token y reutilizar el access token" "revocación 200; el access token sigue en 200 hasta expirar; el refresh token ya no sirve"
curl -s -o /dev/null -w 'revocación: %{http_code}\n' -X POST "$DOMAIN/oauth2/revoke" \
  -H 'Content-Type: application/x-www-form-urlencoded' -d "token=$TD_REFRESH" -d "client_id=$CLIENT"
call "$TD" GET /v1/donations/me "" | sed -E 's/^.*( \[[0-9]+\])$/access token revocado:\1/'
curl -s -o /dev/null -w 'renovar con el refresh token: %{http_code}\n' -X POST "$DOMAIN/oauth2/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' -d grant_type=refresh_token \
  -d "client_id=$CLIENT" -d "refresh_token=$TD_REFRESH"
echo "Para completar T13, repite la llamada pasados 15 minutos: debe responder 401."

echo
echo "Demo terminada."
