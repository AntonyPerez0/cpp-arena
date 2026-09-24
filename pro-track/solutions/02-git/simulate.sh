#!/usr/bin/env bash
# Maintainer check: performs every task in the project's README with plain git.
set -e
export GIT_AUTHOR_NAME=Learner GIT_AUTHOR_EMAIL=l@example.com GIT_COMMITTER_NAME=Learner GIT_COMMITTER_EMAIL=l@example.com
git init -q -b main
git add -A
git commit -qm "Import the Pro Track starter"
D=projects/02-git

git switch -qc feature/intro
printf '# About me\nI am learning C and C++.\nGoal: ship production code.\n' > $D/intro.md
git add $D/intro.md
git commit -qm "Add an introduction"
git switch -q main
git merge -q --no-ff feature/intro -m "Merge branch 'feature/intro'"

git switch -qc feature/captain-a
sed -i 's/^captain: TBD/captain: karrigan/' $D/roster.txt
git commit -qam "Name karrigan as captain"
git switch -q main
git switch -qc feature/captain-b
sed -i 's/^captain: TBD/captain: ropz/' $D/roster.txt
git commit -qam "Name ropz as captain"
git switch -q main
git merge -q --no-ff feature/captain-a -m "Merge branch 'feature/captain-a'"
git merge -q --no-ff feature/captain-b -m "Merge branch 'feature/captain-b'" || true
printf 'team: arena five\ncaptain: karrigan\nvice-captain: ropz\n' > $D/roster.txt
git add $D/roster.txt
git commit -qm "Merge branch 'feature/captain-b'"

echo "oops" >> $D/intro.md
git commit -qam "Add a typo to the intro"
git revert --no-edit HEAD >/dev/null

git tag -a v0.1.0 -m "First release"
