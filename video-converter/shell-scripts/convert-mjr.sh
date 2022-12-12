#!/bin/bash
PROCESSED_RECORDINGS_FOLDER="/usr/src/app/recordings"

echo "==========================="
echo "     CONVERT-MJR           "
echo "==========================="

DIR=$1;
echo $DIR;

FILES="$PROCESSED_RECORDINGS_FOLDER/$DIR/*.mjr"

for FILE in $FILES
do

  echo "$FILE"

  FILENAME="${FILE%.*}"

  if [[ "$FILE" == *"-video"* ]]; then

    echo "Processing video..."
    janus-pp-rec $FILE $FILENAME".webm"

  fi

  if [[ "$FILE" == *"-audio"* ]]; then
    echo "Processing audio..."
    janus-pp-rec $FILE $FILENAME".opus"
  fi

done
