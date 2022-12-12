const playerVersion = '1.12';
console.log('::: TSA VIDEOCALL PLAYER Version', playerVersion);

const BASE_PATH = config.BASE_PATH || 'http://localhost:3000';
const CHECK_INTERVAL_MS = config.CHECK_INTERVAL_MS || 5000;
const POSITION_TO_FORCE_CONVERSION = config.POSITION_TO_FORCE_CONVERSION || 10;

let url = new URL(window.location.href);
let room = url.searchParams.get("room");
let jobId = url.searchParams.get("job");
let forced = url.searchParams.get("forced");

console.log('Room:', room, 'JobId:', jobId);

/**
 * Run initial checks to get converted video state
 */
async function runChecks() {

    const videos = await checkProcessedVideo();
    console.log(videos);
    if (!videos) {
        displayNotFound();
        return;
    } 

    if (videos.length > 0) {
        loadProcessedVideo();
        return;
    }
    
    if (jobId) {
        checkStatus();
        return;
    }

    // Uncomment this part for dev.
    // if (videos.length === 0) {
    //     forceConversion();
    // }

   // Comment this part for dev.
   const jobFileFound = await checkJobFile();
   console.log(jobFileFound);
}

/**
 * Find .TXT file created by bash script on server.
 * This file should contain jobId
 */
async function checkJobFile() {
    console.log('Checking for Job file...');
    const txtFilePath = `${BASE_PATH}/files/${room}/${room}.txt`;
    const response = await fetch(txtFilePath);
    if (response.status === 404) {
        console.log('TXT for Room:', room, 'was not found at:', txtFilePath);
        return false;
    }

    try {
        const json = await response.json();
        url.searchParams.set("job", json.jobId);
        document.location.href = url.toString();
    } catch (err) {
        console.error(err);
        alert(err);
    }
}

/**
 * Check for video existance at special endpoint.
 * Returns quantity of processed files. 
 * If [null] or [undefined] then we don't have files in place yet
 */
async function checkProcessedVideo() {
    console.log('Checking for already processed video file...')
    const response = await fetch(`${BASE_PATH}/videos/${room}/processed`);
    console.log(response);
    if (response.status === 404) {
        return null;
    }

    try {
        const json = await response.json();
        if (Array.isArray(json)) {
            return json;
        } else {
            return null;
        }
    } catch (err) {
        console.error(err);
        alert(err);
    }
}

/**
 * Check status and display UI accordingly
 */
async function checkStatus() {
    console.log('Querying status for jobId:', jobId);
    if (!jobId) return;

    const response = await fetch(`${BASE_PATH}/job/${jobId}`);
    const json = await response.json();
    const { state, progress, reason, position } = json;
    console.log(state, progress, reason);

    if (state === 'active') {
        console.log('Quering status...');

        $("#txtProgressTitle").text(`Обработка видео...`);
        $("#txtProgressDesc").text(progress);
        $("#txtDontReload").fadeOut(1000);
        $("#txtDontReload").fadeIn(1000);
        setTimeout(checkStatus, CHECK_INTERVAL_MS);
        return;
    }

    if (state === 'completed') {
        loadProcessedVideo();
        return;
    }

    if (state === 'waiting') {

        if (position > POSITION_TO_FORCE_CONVERSION && !forced) {
            forceConversion();
        }

        $("#txtProgressTitle").text('Пожалуйста, подождите...');
        $("#txtProgressDesc").text(`Это видео добавлено в очередь на обработку. Позиция: ${position}`);
        $("#txtDontReload").fadeOut(1000);
        $("#txtDontReload").fadeIn(1000);
        setTimeout(checkStatus, CHECK_INTERVAL_MS);
        return;
    }

    if (state === 'failed') {
        $("#txtProgressTitle").text(`Произошла ошибка`);
        $("#txtProgressDesc").text(progress);
        $("#txtErrorMessage").fadeIn("slow");
        $("#txtErrorMessage").text(reason);
        $("#txtDontReload").fadeOut(100);
        $("#divForceConversion").fadeIn("slow");
        checkMixedVideos();
        return;
    }

    $("#txtProgressTitle").text(state);
    $("#txtProgressDesc").text(progress);
}

/**
 * Displays NotFound section
 */
function displayNotFound() {
    console.log('Folder with videos for room:', room, 'was not found');
    $("#txtProgressTitle").text("Видео отсутствует");
    $("#txtProgressDesc").text(`Для указанной комнаты [${room}] не найдена директория с файлами`);
    $("#txtNotFound").fadeIn("slow");
}

/**
 * Load player with processed file
 */
function loadProcessedVideo() {

    $("#divProgress").hide();
    $("#divVideo").fadeIn("slow");
    $('#divVideo video source').attr('src', `${BASE_PATH}/files/${room}/${room}.mkv`);
    $("#divVideo video")[0].load();
}

/**
 * Check if we have some mixed videos to show
 */
function checkMixedVideos() {
    fetch(`${BASE_PATH}/videos/${room}/mixed`)
        .then((response) => {
            if (response.status >= 200 && response.status <= 299) {
                return response.json();
            } else {
                throw Error(response.statusText);
            }
        })
        .then((jsonResponse) => {
            console.log(jsonResponse);

            if (jsonResponse.error) {
                displayNotFound();
            }

            if ((Array.isArray(jsonResponse) && (jsonResponse.length > 0))) {

                jsonResponse.forEach(item => {
                    $("#lstMixedVideos").append(`<li><a href="${BASE_PATH}/files/${room}/${item.filename}" class="text-white" target="_blank">${item.filename}</a></li>`);
                });

                $("#divMixedVideos").fadeIn("slow");
            }

        }).catch((error) => {
            // Handle the error
            console.log(error);
            console.log('FIRST CATCH: ', error.message);
        });
}

/**
 * Force conversion job
 */
function forceConversion() {
    console.log('FORCED CONVERSION STARTED');
    try {
        fetch(`${BASE_PATH}/videos/${room}?priority=100`)
            .then((response) => {
                if (response.status >= 200 && response.status <= 299) {
                    return response.json();
                } else {
                    throw Error(response.statusText);
                }
            })
            .then((jsonResponse) => {
                console.log(jsonResponse);
                if (jsonResponse.jobId) {
                    jobId = jsonResponse.jobId;

                    url.searchParams.set("job", jobId);
                    url.searchParams.set("forced", true);
                    document.location.href = url.toString();

                    checkStatus();
                } else {
                    displayNotFound();
                }

            }).catch((error) => {
                // Handle the error
                console.log(error);
                console.log('Возникла проблема с вашим fetch запросом: ', error.message);
                displayNotFound();
            });
    } catch (error) {
        console.log('Возникла проблема с вашим fetch запросом: ', error.message);
        displayNotFound();
    }
}

/**
 * Main initializer
 */
runChecks();

