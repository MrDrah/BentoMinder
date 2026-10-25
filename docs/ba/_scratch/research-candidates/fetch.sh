#!/bin/sh
# usage: fetch.sh url... ; prints code, title; saves html to pages/<md5>.html; 3s apart
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"
mkdir -p pages
for u in "$@"; do
  f=pages/$(printf '%s' "$u" | md5sum | cut -c1-12).html
  code=$(curl -sL -A "$UA" -H "Accept-Language: ja,en;q=0.8" -o "$f" -w "%{http_code}" "$u")
  t=$(tr '\n' ' ' < "$f" | grep -o '<title[^>]*>[^<]*' | head -1 | sed 's/<title[^>]*>//')
  echo "$code | $u | $t | $f"
  echo "$code	$u	$t	$f" >> fetchlog.tsv
  sleep 3
done
