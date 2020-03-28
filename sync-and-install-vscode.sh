#!/bin/sh

set -e

# build here
npm run build
cd vscode-dsl/server
npm install ../..
cd ..
npm test
npm run package
npm run use