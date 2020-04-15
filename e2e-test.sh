#!/bin/sh

set -e

rm -rf tmp
mkdir -p tmp
cd tmp

npm init -y
npm install ..
mkdir -p public
npx --no-install dsl compile ../example/a.dsl --outDir public/js
test -f public/js/_runtime.mjs
test -f public/js/a.mjs