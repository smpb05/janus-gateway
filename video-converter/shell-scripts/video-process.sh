#!/bin/bash

PIDFILE="/tmp/video-process-action.pid"
JANUS_VIDEO_STORAGE_FOLDER="/usr/src/app/storage/"
PROCESSED_RECORDINGS_FOLDER="/usr/src/app/recordings/"
CONVERTER_LOCAL_PORT="5000"

create_pidfile () {
  echo $$ > "$PIDFILE"
}

remove_pidfile () {
  [ -f "$PIDFILE" ] && rm "$PIDFILE"
}

previous_instance_active () {

  local prevpid
  if [ -f "$PIDFILE" ]; then
    prevpid=$(cat "$PIDFILE")
    kill -0 $prevpid 
  else 
    false
  fi
}

do_the_action () {

  echo 'Moving MJR files: Started...'
  cd $JANUS_VIDEO_STORAGE_FOLDER 
  find . -iname '*.mjr' -exec mv -t $PROCESSED_RECORDINGS_FOLDER {} +
  echo 'Moving MJR files: Finished'

  echo 'Organizing MJR files: Started...'
  cd $PROCESSED_RECORDINGS_FOLDER

  for FILE in videoroom-*.mjr
  do
    if [ -f "$FILE" ]; then
      FOLDER=$(echo $FILE| cut -d'-' -f 2)
      if [ -d $FOLDER ]
      then
        echo "${FOLDER} does exist" > /dev/null
      else
        mkdir $FOLDER
      fi

      # Organizing files
      find . -iname "videoroom-${FOLDER}*.mjr" -exec mv -t $FOLDER {} + > /dev/null 2>&1
      curl http://127.0.0.1:"$CONVERTER_LOCAL_PORT"/videos/"$FOLDER" -o "$FOLDER/$FOLDER.txt" >/dev/null 2>&1
      echo "Done processing files for folder: $FOLDER"
    fi
  done
  echo 'Organizing MJR files: Finished...'
}

if previous_instance_active
then 
  date +'PID: $$ Previous instance is still active at %H:%M:%S, aborting ... '
else 
  trap remove_pidfile EXIT
  create_pidfile
  do_the_action
fi
