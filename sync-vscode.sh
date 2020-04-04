#!/bin/sh

set -e

npm run build
npm ci --production

cd vscode-dsl/server
npm pack ../..
npm install audio-dsl-1.0.0.tgz
cd ../..

npm install