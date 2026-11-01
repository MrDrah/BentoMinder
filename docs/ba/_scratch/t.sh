#!/bin/bash
for u in "$@"; do
 f=$(mktemp); code=$(curl -s -m 25 -L -A "Mozilla/5.0" -o $f -w '%{http_code}' "$u")
 t=$(grep -o '<title>[^<]*' $f | head -1 | sed 's/<title>//' | cut -c1-70)
 txt=$(sed 's/<script[^>]*>.*<\/script>//g;s/<[^>]*>/ /g' $f | tr -s ' \n\t' ' ')
 tm=$(echo "$txt" | grep -o '[0-9]\+ *分' | head -2 | tr '\n' ',')
 kw=""; for k in 卵 チーズ バター 牛乳 小麦粉 パン粉 食パン スパゲ パスタ 麺 うどん えび ツナ 鮭 ごま ; do echo "$txt" | grep -q "$k" && kw="$kw $k"; done
 echo "$code|$u|$t|$tm|$kw"
 rm $f; sleep 2
done
