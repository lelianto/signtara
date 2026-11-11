#!/bin/sh
# Downloads public Kaggle archives (anonymous endpoint) into separate directories.
set -e
mkdir -p "$(dirname "$0")/../datasets/raw" && cd "$(dirname "$0")/../datasets/raw"
mkdir -p bisindo-40-kata-mp4 bisindo-dinamis-5kata-b wl-bisindo
get() { echo "start $2"; curl -sSL --retry 3 -o "$2/archive.zip" "https://www.kaggle.com/api/v1/datasets/download/$1"; echo "done $2 $(du -h "$2/archive.zip" | cut -f1)"; }
get anggiyohanespardede/bisindo-40-kata-mp4 bisindo-40-kata-mp4 &
get muhammaddhiaulhaq/bahasa-isyarat-indonesia-dinamis bisindo-dinamis-5kata-b &
get glennleonali/wl-bisindo wl-bisindo &
wait
echo ALL_DONE
