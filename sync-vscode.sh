#!/bin/sh

set -e

npm run build
npm ci --production

cd vscode-dsl/server
npm install ../..
cd ../..

npm install