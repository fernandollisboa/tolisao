#!/bin/sh
# depois de cada edição no app.js, a IA já fica sabendo se quebrou sintaxe ou tipo,
# sem esperar o CI. Meio segundo; saída 2 manda o erro de volta pro Claude.
f=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input.file_path||"")}catch{}})')
case "$f" in */app.js) ;; *) exit 0 ;; esac
cd "$CLAUDE_PROJECT_DIR" || exit 0
node --check app.js >&2 || exit 2
[ -x node_modules/.bin/tsc ] || exit 0   # sem npm ci, fica só a sintaxe
node_modules/.bin/tsc -p jsconfig.json >&2 || exit 2
