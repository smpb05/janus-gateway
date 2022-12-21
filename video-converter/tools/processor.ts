import * as ffmpeg from 'fluent-ffmpeg';
const config = require('../config');
import { checkForProcessedFile, getFilesForConcat, getFilesForDelete, getFilesForMixing, getMixedFiles, IFilesToConcat, IVideoFile } from './file-utils';
const util = require('util');
const exec = util.promisify(require('child_process').exec);
import * as fs from "fs";

/**
 * Main entry point for processor
 * @param {*} job 
 */
module.exports = async (job) => {
    ffmpeg.setFfmpegPath(config.ffmpegPath);
    console.log(`Processor called for job: ${job.id}`);

    return new Promise(async (resolve, reject) => {
        try {
            // Check if we already have processed file in folder
            const processedFiles = await checkForProcessedFile(job.data.id);
            if (processedFiles.length > 0) {
                job.progress(`${job.data.id}.mkv`);
                resolve(`${job.data.id}.mkv`);
                return;
            }

            // Convert MJR files to .opus and .webm
            try {
                console.log(":: CONVERT MJR");
                job.progress(`${job.id}:${job.data.id}:convert-mjr`);
                await exec(`( bash ${config.convertScriptPath} ${job.data.id} )`);
            } catch (err) {
                console.error(err);
            };

            await sleep(1000);

            // Add sound to videos
            const sFiles = await getFilesForMixing(job.data.id);
            for (const file of sFiles) {
                await mixOpusWebm(job.data.id, file, job)
            }
            await sleep(1000);

            // Convert to MKV
            const mixedFiles = await getMixedFiles(job.data.id);
            for (const mixedFile of mixedFiles) {
                await convertToMKV(job.data.id, mixedFile, job);
            }

            // Await until files will be stored in file system.
            await sleep(1000);

            const userFileGroups = await getFilesForConcat(job.data.id);

            // Add blank video in time gaps
            const convertedFiles = await alignFiles(userFileGroups);
            await sleep(1000);

            // Merge files (hstack)
            const finalFile = await mergeFiles(convertedFiles, job);

            // Cleanup
            try {
                await sleep(2000); // give it a second to unlock files
                const filesToDelete = await getFilesForDelete(job.data.id);
                await deleteTempFiles(filesToDelete);
            } catch (error) {
                console.log(error);
            }

            // Finalize job execution
            job.progress(finalFile);
            resolve(finalFile);

        } catch (error) {
            console.log(error);
            reject(error);
        }
    });
}

/**
 * Adds sound to video
 * @param {number} id - Room ID 
 * @param {*} file - Complex file object, that contains user ID and two files (audio & video) 
 * @param {*} job - Bull's job object
 */
function mixOpusWebm(id, file, job) {
    return new Promise(async (resolve, reject) => {
        const finalFileName = file.fileA.filename.endsWith('.webm') ? file.fileA.filename : file.fileB.filename;
        // mix .webm & .opus
        ffmpeg()
            .addInput(`${config.videosBaseDir}/${id}/${file.fileA.filename}`)
            .addInput(`${config.videosBaseDir}/${id}/${file.fileB.filename}`)
            .addOutputOption('-codec copy')
            .addOptions([`-threads ${config.ffmpegThreads}`])
            .on('start', function (commandLine) {
                console.log('FFMPEG | MIX_OPUS_WEBM | ' + commandLine);
            })
            .on('error', function (err) {
                console.log('An error occurred: ' + err.message);
                reject(err);
            })
            .on('progress', function (progress) {
                let progressText = `${job.id}:${job.data.id}:mixing:${file.user}:${progress.percent}`;
                console.log(progressText);
                job.progress(progressText);
            })
            .on('end', function () {
                console.log(`Mixing for ${file.user} finished!`);
                resolve('all ok');
            })
            .save(`${config.videosBaseDir}/${id}/mixed-${finalFileName}`)
            .run();
    });
}

/**
 * Convert mixed file to MKV and rescale if we have portrait video
 * @param {number} id - Room ID 
 * @param {*} file - mixed file object (*.webm)
 * @param {*} job - Bull's job object
 */
function convertToMKV(id, file, job) {
    return new Promise(async (resolve, reject) => {
        const initialFile = `${config.videosBaseDir}/${id}/${file.filename}`;
        const metadata = await getMetadata(initialFile);
        const duration = metadata.format.duration;
        const width = metadata.streams[0].width;
        const height = metadata.streams[0].height;

        console.log(initialFile);
        console.log(`DURATION: ${duration}`);
        console.log(`WIDTH: ${width}`);
        console.log(`HEIGHT: ${height}`);

        // mix .webm & .opus
        let command = ffmpeg();
        command
            .addInput(initialFile)
            //.size('?x240')
            //.videoBitrate('192k')
            .addOptions(['-filter:v scale=-2:240'])
            .addOptions([`-threads ${config.ffmpegThreads}`])
            .addOptions(['-vcodec libx264'])
            .addOptions(['-crf 21'])
            .addOptions(['-preset veryfast'])
            .on('start', function (commandLine) {
                console.log('FFMPEG | CONVERT_MKV | ' + commandLine);
            })
            .on('error', function (err) {
                console.log('An error occurred: ' + err.message);
                reject(err);
            })
            .on('progress', function (progress) {
                let progressText = `${job.id}:${job.data.id}:convert-mkv:${file.user}:${progress.percent}`;
                console.log(progressText);
                job.progress(progressText);
            })
            .on('end', function () {
                console.log(`Converting for ${file.user} finished!`);
                resolve('all ok');
            })
            .save(`${config.videosBaseDir}/${id}/converted-${file.filename}.mkv`)
            .run();
    });
}

async function alignFiles(userFilesGroups: IFilesToConcat[]) {
    const files: IVideoFile[] = [];

    // First of all concat user files with black screen for time gaps.
    for (let group of userFilesGroups) {
        if (group.files.length > 1) {
            const file = await alignUserFiles(group);
            files.push(file);
            continue;
        }

        files.push(group.files[0]);
    }

    // Wait util all files will be stored in file system.
    sleep(1000);

    // Then align videos start/end time.
    const alignedVideos = await alignRoomFiles(files);
    return alignedVideos;
}

/**
 * Add time gaps between user video files.
 * @param {*} userFileGroup Video files grouped by user.
 */
function alignUserFiles(userFileGroup: IFilesToConcat): Promise<IVideoFile> {
    return new Promise(async (resolve) => {
        const { files } = userFileGroup;
        files.sort((a, b) => {
            return a.time - b.time;
        });

        for (let i = 0; i < files.length; i++) {
            const metadata = await getMetadata(`${config.videosBaseDir}/${files[i].folder}/${files[i].filename}`);
            files[i].duration = metadata.format.duration;
            files[i].width = metadata.streams[0].width;
            files[i].height = metadata.streams[0].height;

            // Start time counts in microseconds, duration counts in seconds.
            const endTime = files[i].time + files[i].duration! * 1000000;
            if (files[i + 1]) {
                // Calculate black screen duration in seconds
                files[i].timeshift = Math.floor((files[i + 1].time - endTime) / 1000000);
                files[i].colorFilterId = `[b${i}]`;
                files[i].colorFilter = `color=black:s=${files[i].width}x${files[i].height}:r=24}`;
                files[i].blackScreenFile = await generateBlackScreen(files[i]);
            } else {
                files[i].timeshift = 0;
            }

            files[i].videoId = `[${i}:v]`;
            files[i].filepath = `${config.videosBaseDir}/${files[i].folder}/${files[i].filename}`;
        }

        // Wait until black screen file will be saved.
        await sleep(1000);

        let filesToConcat = '';
        for (const file of files) {
            filesToConcat = `${filesToConcat}file ${config.videosBaseDir}/${file.folder}/${file.filename} \n`;
            if (file.blackScreenFile) {
                filesToConcat = `${filesToConcat}file ${file.blackScreenFile} \n`;
            }
        }

        const videosListFileName = `${config.videosBaseDir}/${files[0].folder}/videos.txt`;
        await writeFile(videosListFileName, filesToConcat);
        await sleep(1000);

        const outputFile = `${config.videosBaseDir}${files[0].folder}/final${files[0].filename}`;
        await concatMedia(videosListFileName, outputFile);
        //await renameProcessedFiles(files);
        resolve({
            filename: `final${files[0].filename}`,
            folder: files[0].folder,
            time: files[0].time,
            type: files[0].type,
            user: userFileGroup.user,
        });
    });
}

/**
 * Concat media files.
 * @param {string} inputListFileName Path to the txt file with list of media files to concat.
 * @param {string} outputFileName Path to the new file made with concat.
 */
function concatMedia(inputListFileName, outputFileName): Promise<void> {
    return new Promise((resolve, reject) => {
        const concatCommand = ffmpeg();
        concatCommand
            .input(inputListFileName)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions('-c copy')
            .save(outputFileName)
            .on('error', (err) => {
                console.log('An error occurred: ' + err.message);
                reject(err);
            })
            .on('start', (cmdline) => {
                console.log('FFMPEG | CONCAT_FILES | ' + cmdline);
            })
            .on('end', async () => {
                console.log('Merging finished !');
                resolve();
            })
            .run();
    });
}

/**
 * Write file to file system.
 * @param {string} filename File name.
 * @param {string} text File body
 */
function writeFile(filename: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.writeFile(filename, text, (err) => {
            if (err) {
                reject(err);
            }

            resolve();
        });
    });
}

/**
 * Creates black screen file based on timeshift duration
 * @param {*} file 
 */
function generateBlackScreen(file: IVideoFile): Promise<string> {
    const blackScreenFile = `${config.videosBaseDir}/${file.folder}/black-t${file.timeshift}-${file.filename}`;
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input('color=black:s=320x240:r=24')
            .inputFormat('lavfi')
            .input('anullsrc')
            .inputFormat('lavfi')
            .outputOption('-ar 48000')
            .outputOption(`-t ${file.timeshift}`)
            .audioChannels(2)
            .addOptions([`-threads ${config.ffmpegThreads}`])
            .save(blackScreenFile)
            .on('start', function (commandLine) {
                console.log('FFMPEG | GEN_BLACK_SCREEN | ' + commandLine);
            })
            .on('error', function (err) {
                console.log('An error occurred: ' + err.message);
                reject(err);
            })
            .on('progress', function (progress) {
                console.log(progress);
            })
            .on('end', function () {
                console.log(`Processing for finished!`);
                resolve(blackScreenFile);
            })
            .run();
    });
}

/**
 * Syncronize video files start/end time by adding black screen.
 * @param files Files array that should be aligned.
 */
async function alignRoomFiles(files: IVideoFile[]): Promise<IVideoFile[]> {
    // Align videos by start time.
    const filesAlignedByStartTime: IVideoFile[] = await alignFilesStartTime(files);

    // Align videos by end time.
    const alignedFiles: IVideoFile[] = await alignFilesEndTime(filesAlignedByStartTime);

    return alignedFiles;
}

async function alignFilesStartTime(files: IVideoFile[]) {
    files.sort((a, b) => {
        return a.time - b.time;
    });
    const filesAlignedByStartTime: IVideoFile[] = [];
    for (let i = 0; i < files.length; i++) {
        const metadata = await getMetadata(`${config.videosBaseDir}/${files[i].folder}/${files[i].filename}`);
        files[i].duration = metadata.format.duration;
        files[i].width = metadata.streams[0].width;
        files[i].height = metadata.streams[0].height;

        // Do not process first video as it is the erliest video.
        if (i === 0) {
            filesAlignedByStartTime.push(files[i]);
            continue;
        }

        const firstFile = files[0];
        files[i].timeshift = Math.floor((files[i].time - firstFile.time) / 1000000);

        // If timeshift is less than 2 seconds skip aligning.
        if ((files[i].timeshift ?? 0) < 2) {
            filesAlignedByStartTime.push(files[i]);
            continue;
        }

        files[i].colorFilterId = `[b${i}]`;
        files[i].colorFilter = `color=black:s=${files[i].width}x${files[i].height}:r=24`;
        files[i].blackScreenFile = await generateBlackScreen(files[i]);
        files[i].videoId = `[${i}:v]`;
        files[i].filepath = `${config.videosBaseDir}/${files[i].folder}/${files[i].filename}`;

        // Wait until black screen file will be saved.
        await sleep(100);

        // Create txt file with videos list for concat demuxer.
        let filesToConcat = `file ${files[i].blackScreenFile}\nfile ${files[i].filepath}`;
        const videosListFileName = `${config.videosBaseDir}/${files[0].folder}/videos-${files[i].filename}.txt`;
        await writeFile(videosListFileName, filesToConcat);
        await sleep(100);

        // Concat video with black screen.
        const outputFile = `${config.videosBaseDir}${files[i].folder}/final${files[i].filename}`;
        await concatMedia(videosListFileName, outputFile);

        filesAlignedByStartTime.push({
            filename: `final${files[i].filename}`,
            folder: files[i].folder,
            time: firstFile.time,
            type: files[i].type,
            user: files[i].user,
        });
    }

    return filesAlignedByStartTime;
}

async function alignFilesEndTime(files: IVideoFile[]) {
    console.log({ files });
    files.sort((a, b) => {
        return (a.duration ?? 0) - (b.duration ?? 0);
    });

    // Align files by end time.
    const longestDuration = files[files.length - 1].duration ?? 0;
    const alignedFiles: IVideoFile[] = [];
    for (var i = 0; i < files.length; i++) {
        const file = files[i];

        // Skip aligning of last file as it's the longest.
        if (i === files.length - 1) {
            alignedFiles.push(file);
            continue;
        }

        // Skip aligning if time diff is less than 2 seconds.
        const timeDiff = longestDuration - (file.duration ?? 0);
        if (timeDiff < 2) {
            alignedFiles.push(file);
            continue;
        }

        files[i].timeshift = Math.floor(timeDiff);
        files[i].colorFilterId = `[b${i}]`;
        files[i].colorFilter = `color=black:s=${files[i].width}x${files[i].height}:r=24`;
        files[i].blackScreenFile = await generateBlackScreen(files[i]);
        files[i].videoId = `[${i}:v]`;
        files[i].filepath = `${config.videosBaseDir}/${files[i].folder}/${files[i].filename}`;

        // Create txt file with videos list for concat demuxer.
        let filesToConcat = `file ${files[i].filepath}\nfile ${files[i].blackScreenFile}`;
        const videosListFileName = `${config.videosBaseDir}/${files[0].folder}/videos-end-${files[i].filename}.txt`;
        await writeFile(videosListFileName, filesToConcat);
        await sleep(100);

        // Concat video with black screen.
        const outputFile = `${config.videosBaseDir}${files[i].folder}/aligned${files[i].filename}`;
        await concatMedia(videosListFileName, outputFile);

        alignedFiles.push({
            filename: `aligned${files[i].filename}`,
            folder: files[i].folder,
            time: files[i].time,
            type: files[i].type,
            user: files[i].user,
        });
    }

    return alignedFiles;
}

/**
 * Merge videos horizontally using ffmpeg -hstack
 * @param {*} files 
 */
function mergeFiles(files: IVideoFile[], job) {
    return new Promise((resolve, reject) => {
        const finalFileName = `${config.videosBaseDir}/${files[0].folder}/${files[0].folder}.mkv`;
        const command = ffmpeg();

        for (const file of files) {
            command.addInput(`${config.videosBaseDir}/${file.folder}/${file.filename}`);
        }
        command
            .complexFilter(`hstack=inputs=${files.length};amerge=inputs=${files.length}`)
            .audioChannels(files.length)
            .addOptions(['-vcodec libx264'])
            .addOptions(['-crf 21'])
            .addOptions(['-preset veryfast'])
            .addOptions([`-threads ${config.ffmpegThreads}`])
            .save(finalFileName)
            .on('start', function (commandLine) {
                console.log('FFMPEG | MERGE_FILES | ' + commandLine);
            })
            .on('error', function (err) {
                console.log('An error occurred: ' + err.message);
                reject(err);
            })
            .on('progress', function (progress) {
                let progressText = `${job.id}:${job.data.id}:merge:${progress.percent}`;
                console.log(progressText);
                job.progress(progressText);
            })
            .on('end', function () {
                console.log(`Merge finished!`);
                resolve(finalFileName);
            })
            .run();
    });
}

/**
 * Delete temporary files created during conversion process
 * @param {*} files 
 */
function deleteTempFiles(files): Promise<void> {
    return new Promise((resolve, reject) => {
        for (const file of files) {
            fs.unlink(file.filepath, (err) => {
                if (err) {
                    console.error(err);
                    reject(err);
                    return;
                }
            });
        }

        resolve();
    });
}


/**
 * Retrieve metadata for media file (duration, width, height, etc)
 * @param {*} filePath 
 */
function getMetadata(filePath): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            resolve(metadata);
        });
    });
}

/**
 * Waits for N ms
 * @param {*} ms 
 */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
