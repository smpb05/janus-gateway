for FILE in *.mjr
do
  if [ -f "$FILE" ]; then
    FOLDER=$(echo $FILE| cut -d'-' -f 2)

    if [ -d $FOLDER ]
    then
      echo "${FOLDER} does exist" > /dev/null
    else
      mkdir $FOLDER
    fi

    # Trying to move files"
    find -name "videoroom-${FOLDER}*.mjr" -exec mv -t $FOLDER {} + > /dev/null 2>&1

    echo "Processed ${FOLDER}"
  fi
done
