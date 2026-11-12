#!/usr/bin/env bash
# CA-NF05: con 50 proyectos, el 95 % de los GET debe responder en 1.5 s o menos, sin cold start.
# Ejecutar en CloudShell, que está en la misma región (cliente cercano).
# Uso: bash scripts/perf-catalog.sh
set -u
source "$(dirname "$0")/lib.sh"
load_stack

current=$(curl -s "$API/v1/projects" | jq '.items | length')
needed=$((50 - current))
if [ "$needed" -gt 0 ]; then
  login gestor
  echo "Publicando $needed proyectos de prueba..."
  for i in $(seq "$needed"); do
    id=$(call "$ACCESS" POST /v1/projects "{\"title\":\"Proyecto de carga $i\",\"description\":\"Dato ficticio\",\"goalAmountCents\":100000}" | body | jq -r .projectId)
    call "$ACCESS" PATCH "/v1/projects/$id/publish" "" >/dev/null
  done
fi

echo "Proyectos publicados: $(curl -s "$API/v1/projects" | jq '.items | length')"
for _ in 1 2 3 4 5; do curl -s -o /dev/null "$API/v1/projects"; done # descarta cold start

samples=100
times=$(for _ in $(seq "$samples"); do curl -s -o /dev/null -w '%{time_total}\n' "$API/v1/projects"; done | sort -n)
p50=$(echo "$times" | sed -n "$((samples / 2))p")
p95=$(echo "$times" | sed -n "$((samples * 95 / 100))p")
max=$(echo "$times" | tail -1)

echo "Método: $samples solicitudes secuenciales con curl desde CloudShell en la misma región"
echo "Fecha: $(date -u +%Y-%m-%dT%H:%MZ)"
echo "p50: ${p50}s | p95: ${p95}s | máximo: ${max}s"
if awk "BEGIN{exit !($p95 <= 1.5)}"; then echo "CA-NF05.1 CUMPLIDO"; else echo "CA-NF05.1 NO CUMPLIDO"; fi
