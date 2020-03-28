#!/bin/sh

set -e

# build here
npm run build
cd vscode-dsl/server
npm install ../..