#!/bin/sh
# usage: fetch.sh name url ; saves pages/<name>.html; prints code + title; sleeps 3s
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"
cd "$(dirname "$0")"
f=pages/$1.html
code=$(curl -sL --compressed -A "$UA" -H "Accept-Language: ja,en;q=0.8" -o "$f" -w "%{http_code}" "$2")
t=$(tr '\n' ' ' < "$f" | grep -o '<title[^>]*>[^<]*' | head -1 | sed 's/<title[^>]*>//')
echo "$code | $1 | $t | $(wc -c < $f)"
printf '%s\t%s\t%s\t%s\n' "$code" "$1" "$2" "$t" >> fetchlog.tsv
sleep 3
