#!/usr/bin/env bash
# Maintainer check: a freshly imported starter (one commit).
set -e
git init -q -b main
git -c user.name=Learner -c user.email=l@example.com add -A
git -c user.name=Learner -c user.email=l@example.com commit -qm "Import the Pro Track starter"
