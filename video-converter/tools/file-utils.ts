import * as config from "../config";
import * as fs from "fs";
import * as ffmpeg from 'fluent-ffmpeg'

// TODO: Refactor boilerplating for file search in dirs

export interface IVideoFile {
    folder: number;
    user: number;
    time: number;
    filename: string;
    type: string;
    duration?: number;
    width?: number;
    height?: number;
    timeshift?: number;
    colorFilterId?: string;
    colorFilter?: string;
    blackScreenFile?: string;
    videoId?: string;
    filepath?: string;
}

export interface IVideoGroupForMixing {
    user: number;
    fileA: IVideoFile;
    fileB: IVideoFile;
}

export interface IVideoFilePathInfo {
    folder: number;
    filename: string;
    filepath: string;
}

export interface IFilesToConcat {
    files: IVideoFile[],
    user: number,
}

export interface RoomFileInterface {
    fileName: string;
    size: number;
    created: string;
}

export interface RoomDataInterface {
    list: RoomFileInterface[]
}

export interface VideoDurationErrorDataInterface {
    message: string;
}

export interface VideoDurationDataInterface {
    filename: string;
    duration: number
}

export interface VideoDurationinterface {
    status: 'OK' | 'ERROR',
    data: VideoDurationErrorDataInterface | VideoDurationDataInterface
}

/**
 * Get original files from folder with name {id}, sort them by time, and arrange in groups for mixing
 * @param {*} id 
 */
export async function getFilesForMixing(id: number): Promise<IVideoGroupForMixing[]> {
    const path = config.videosBaseDir + id;
    const dir = await fs.promises.opendir(path);
    let files: IVideoFile[] = [];
    for await (const dirent of dir) {
        if (dirent.name.startsWith('videoroom') && !dirent.name.endsWith('.mjr')) {
            const arr = dirent.name.split('-');
            files.push({ folder: id, user: Number(arr[3]), time: Number(arr[4]), filename: dirent.name, type: arr[5] });
        }
    }
    let sortedFiles = files.slice().sort((a, b) => {
        return a.time - b.time
    });

    let results: IVideoGroupForMixing[] = [];
    for (let i = 0; i < sortedFiles.length - 1; i++) {
        // TODO: should check files for same duration and align it
        // (sortedFiles[i + 1].time == sortedFiles[i].time)
        if (sortedFiles[i + 1].user == sortedFiles[i].user) {
            results.push({
                user: sortedFiles[i].user,
                fileA: sortedFiles[i],
                fileB: sortedFiles[i + 1]
            });
        }
    }

    return new Promise((resolve) => {
        resolve(results);
    });
}

export async function getMixedFiles(id: number): Promise<IVideoFile[]> {
    console.log(':: GET MIXED FILES');
    const path = config.videosBaseDir + id;
    const dir = await fs.promises.opendir(path);
    let files: IVideoFile[] = [];
    for await (const dirent of dir) {
        if (dirent.name.startsWith('mixed')) {
            const arr = dirent.name.split('-');
            files.push({ folder: id, user: Number(arr[4]), time: Number(arr[5]), filename: dirent.name, type: arr[6] });
        }
    }

    return new Promise((resolve) => {
        resolve(files);
    });
}

/**
 * Get user files group that should be concated.
 * @param id Room id.
 */
export async function getFilesForConcat(id: number): Promise<IFilesToConcat[]> {
    console.log(':: GET FILES FOR CONCAT');
    const path = config.videosBaseDir + id;
    const dir = await fs.promises.opendir(path);
    let files: IVideoFile[] = [];
    for await (const dirent of dir) {
        if (dirent.name.startsWith('converted-mixed')) {
            const arr = dirent.name.split('-');
            files.push({ folder: id, user: Number(arr[5]), time: Number(arr[6]), filename: dirent.name, type: arr[7] });
        }
    }

    let results = {};
    for (const file of files) {
        if (!results.hasOwnProperty(file.user)) {
            results[file.user] = { user: file.user, files: [file] };
        } else {
            results[file.user].files.push(file)
        }
    }

    return new Promise((resolve) => {
        resolve(Object.values(results));
    });
}

export async function getFilesForDelete(id: number): Promise<IVideoFilePathInfo[]> {
    console.log(':: GET FILES FOR DELETE');
    const path = config.videosBaseDir + id;
    const dir = await fs.promises.opendir(path);
    let files: IVideoFilePathInfo[] = [];
    for await (const dirent of dir) {
        if (dirent.name.startsWith('converted-mixed')
            || dirent.name.startsWith('aligned')
            || dirent.name.startsWith('black')
            || dirent.name.startsWith('final')
            || dirent.name.startsWith('videos')
            || dirent.name.startsWith('mixed')
            || dirent.name.endsWith('.opus')
            || dirent.name.endsWith('.webm')) {
            console.log(dirent.name);
            files.push({ folder: id, filename: dirent.name, filepath: `${config.videosBaseDir}/${id}/${dirent.name}` });
        }
    }
    return new Promise((resolve) => {
        resolve(files);
    });
}

export async function checkForProcessedFile(id: number): Promise<IVideoFilePathInfo[]> {
    console.log(':: CHECK IF ALREADY HAVE PROCESSED FILE');
    const path = config.videosBaseDir + id;
    const dir = await fs.promises.opendir(path);
    let files: IVideoFilePathInfo[] = [];
    for await (const dirent of dir) {
        if (dirent.name === `${id}.mkv`) {
            console.log(dirent.name);
            files.push({ folder: id, filename: dirent.name, filepath: `${config.videosBaseDir}/${id}/${dirent.name}` });
        }
    }
    return new Promise((resolve) => {
        resolve(files);
    });
}

/**
 * Get files in room folder
 * @param id Room id.
 */
export async function getFilesInRoom (id: number): Promise<RoomDataInterface> {
    console.log(`:: GET FILES FROM ROOM ${id}`);
    const path = config.videosBaseDir + id;
    const files = await fs.promises.readdir(path);
    const stats = await Promise.all(files.map((file) => fs.promises.stat(`${path}/${file}`)));

    const roomData: RoomFileInterface[] = files.map((file, index) => {
        const { size, birthtimeMs } = stats[index];
        const createdDate = new Date(birthtimeMs);
        const created = createdDate.toLocaleString('ru-RU');

        return {
            fileName: file,
            size,
            created,
        };
    });

    return new Promise((resolve) => {
        resolve({list: roomData});
    });
}

/**
 * Retrieve metadata for media file (duration, width, height, etc)
 * @param {*} filePath 
 */
function getMetadata(filePath): Promise<ffmpeg.FfprobeData> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if(err) reject(err);
            resolve(metadata);
        });
    });
}

/**
 * Get files in room folder
 * @param id Room id.
 * @param filename filename should be provided with extension
 */
export async function getVideoDuration (id: number, filename?: string): Promise<VideoDurationinterface> {
    console.log(`:: GET VIDEO DURATION BY ID: ${id}`);
    const pathToDir = config.videosBaseDir + id;
    const name = filename || `${id}.mkv`;
    const pathToVideo = `${pathToDir}/${name}`;
    let duration = 0;
    let errorMessage = '';

    try {
        const metaData = await getMetadata(pathToVideo);
        if(!metaData.format.duration) throw Error('Could not get video duration');
        
        duration = metaData.format.duration;
    } catch (error) {
        errorMessage = error.message;    
    }

    const errorData = {
        message: errorMessage,
    };
    const videoData = {
        filename: name,
        duration,
    }

    return new Promise((resolve) => {
        resolve({
            status: errorMessage ? 'ERROR' : 'OK',
            data: errorMessage ? errorData : videoData,
        });
    });
}