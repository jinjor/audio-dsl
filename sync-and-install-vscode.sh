#!/bin/sh

set -e

./sync-vscode.sh

cd vscode-dsl
# npm test
npm run package
npm run use