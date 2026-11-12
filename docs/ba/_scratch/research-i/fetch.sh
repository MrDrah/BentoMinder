cd /c/Projects/BentoMinder/docs/ba/_scratch/research-i
while IFS=$'\t' read id url name; do
  [ -s html/$id.html ] && continue
  curl -sL -A "Mozilla/5.0 (research; BentoMinder library)" --max-time 40 -o html/$id.html "$url"
  echo "$id $(wc -c < html/$id.html)" >> fetchlog.txt
  sleep 3
done < list.tsv
