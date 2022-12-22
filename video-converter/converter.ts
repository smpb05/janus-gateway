const express = require('express');
const cors = require('cors')
const app = express();
const Queue = require('bull');
const config = require('./config');
import {
  getFilesForMixing,
  checkForProcessedFile,
  getMixedFiles,
  getFilesInRoom,
  getVideoDuration,
} from './tools/file-utils';
const pjson = require('./package.json');
const url = require('url');
const monitoro = require('monitoro');

// Initialize Bull
const videoQueue = new Queue('video converter');
videoQueue.process(config.bullThreads, __dirname + '/tools/processor.ts');

// CORS
app.use(cors());

// Enable Bull's monitoring
const queueConfigArray = [{ name: "video converter", url: config.redisUrl }];
app.locals.MonitoroQueues = queueConfigArray;
app.use('/monitor', monitoro);

// Serve static files for player
app.use('/static', express.static(__dirname + '/public'));
app.use('/files', express.static(config.videosBaseDir));

/**
 * Run converter
 */
app.get('/videos/:id', async (req, res) => {

    let { id } = req.params;
    let { priority } = url.parse(req.url, true).query;
    console.log(`DIRECTORY: ${id}`, 'PRIORITY:', priority);

    let files = await getFilesForMixing(id).catch((err) => {
        res.json({ error: err });
    });

    let job = await videoQueue.add({ id, files }, { priority: priority || 0 });
    res.json({ jobId: job.id });
})

/**
 * Get processed files
 */
app.get('/videos/:id/processed', async (req, res) => {

    let id = req.params.id;
    console.log(`DIRECTORY: ${id}`);

    let files = await checkForProcessedFile(id).catch((err) => {
        res.json({ error: err });
    });

    res.json(files);
})

/**
 * Get mixed files
 */
app.get('/videos/:id/mixed', async (req, res) => {

    let id = req.params.id;
    console.log(`DIRECTORY: ${id}`);

    let files = await getMixedFiles(id).catch((err) => {
        res.json({ error: err });
    });

    res.json(files);
})

/** 
 * Allows the client to query the state of a background job
 */
app.get('/job/:id', async (req, res) => {
    let id = req.params.id;
    let job = await videoQueue.getJob(id);

    if (job === null) {
        res.status(404).end();
    } else {

        const waiting = await videoQueue.getWaiting();
        let position = 0;
        for (let i = 0; i < waiting.length; i++) {
            const job = waiting[i];
            if (job.id === id) {
                position = i + 1; // 0 means job is 1st in queue
                break;
            }
        }

        let state = await job.getState();
        let progress = job._progress;
        let reason = job.failedReason;
        res.json({ id, state, progress, reason, position });
    }
});

/**
 * Get files in room
 */
app.get('/call/filelist/:id', async (req, res) => {
    const files = await getFilesInRoom(req.params.id)
    res.json(files);
});

/**
 * Get video duration by filename or id
 */
app.get('/file/info/:id/:filename*?', async (req, res) => {
    const videoData = await getVideoDuration(req.params.id, req.params.filename)
    res.json(videoData);
});

/**
 * Get application's config file contents
 */
app.get('/config', (req, res) => {
    res.json(config);
});

/**
 * Get app's version from package.json
 */
app.get('/version', (req, res) => {
    res.json({ version: pjson.version });
});

// You can listen to global events to get notified when jobs are processed
videoQueue.on('global:completed', async (jobId, result) => {
    console.log(`Job [${jobId}] completed with result ${result}`);
    const job = await videoQueue.getJob(jobId);
    console.log(job.data.id);
});

videoQueue.on('failed', (job, error) => {
    console.error("Room id " + job.data.id, error);
});

// App starting point
app.listen(config.port || 5000, () => {
    console.log(`::: TSA Videocall Converter started | http://127.0.0.1:${config.port || 5000} | ${new Date()}`);
});
