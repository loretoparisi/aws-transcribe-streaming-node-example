/**
* AWS Transcribe Streaming Example
* Code adpted from https://github.com/shinsaka/transcribe-stream-sample
* @author Loreto Parisi (loretoparisi at gmail dot com)
*/
(function () {

    const { stdout } = require('process');
    const { createReadStream } = require('fs');
    const { Readable, Transform } = require('stream');
    const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming');
    const { NodeHttp2Handler } = require('@aws-sdk/node-http-handler');

    const parseTranscribeStream = new Transform({
        writableObjectMode: true,
        transform(chunk, encoding, cb) {
            if (chunk.TranscriptEvent && chunk.TranscriptEvent.Transcript) {
                const results = chunk.TranscriptEvent.Transcript.Results;
                if (results.length > 0 && results[0].Alternatives.length > 0 && !results[0].IsPartial) {
                    this.push(`${results[0].Alternatives[0].Items[0].StartTime}: ${results[0].Alternatives[0].Transcript}\n`);
                }
            }
            cb();
        }
    });

    (async () => {
        const audioSource = createReadStream(process.argv[2], {
            highWaterMark: 1024
        });

        const audioStream = async function* () {
            for await (const payloadChunk of audioSource) {
                yield { AudioEvent: { AudioChunk: payloadChunk } };
            }
        };

        const command = new StartStreamTranscriptionCommand({
            LanguageCode: 'en-US',
            MediaEncoding: 'pcm',
            // The sample rate of the input audio in Hertz. We suggest that you use 8000 Hz for low-quality audio and 16000 Hz for
            // high-quality audio. The sample rate must match the sample rate in the audio file.
            MediaSampleRateHertz: 16000,
            AudioStream: audioStream()
        });

        const client = new TranscribeStreamingClient({
            region: "us-east-1",
            requestHandler: new NodeHttp2Handler({ sessionTimeout: 5000 })
        });

        const response = await client.send(command);
        const transcriptsStream = Readable.from(response.TranscriptResultStream);

        transcriptsStream.pipe(parseTranscribeStream).pipe(stdout);
    })();

}).call(this);
