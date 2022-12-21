module.exports = {
    port: 5000,
    workDir: "/usr/src/app/",
    videoStorageDir: "/usr/src/app/storage/",
    videosBaseDir: "/usr/src/app/recordings/",
    ffmpegPath: "/usr/local/bin/ffmpeg",
    ffmpegThreads: 0,
    bullThreads: 1,
    redisUrl: "redis://127.0.0.1:6379",
    convertScriptPath: "/usr/src/app/shell-scripts/convert-mjr.sh"
};