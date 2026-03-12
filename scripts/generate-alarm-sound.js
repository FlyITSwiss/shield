/**
 * Generate a SHORT, LOUD alarm sound WAV file
 * Creates an urgent pulsing siren pattern - 1 second, loops in browser
 */

const fs = require('fs');
const path = require('path');

// WAV file parameters
const sampleRate = 44100;
const duration = 1; // 1 second - will loop
const volume = 1.0; // Maximum volume

// Siren frequencies (emergency alert style)
const freqLow = 800;   // Low tone
const freqHigh = 1200; // High tone
const oscillationSpeed = 8; // How fast it oscillates between high/low

// Generate siren wave (oscillating between two frequencies)
function generateSiren(numSamples) {
    const samples = [];

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;

        // Oscillate between low and high frequency
        const freqMod = (Math.sin(2 * Math.PI * oscillationSpeed * t) + 1) / 2;
        const freq = freqLow + (freqHigh - freqLow) * freqMod;

        // Generate the tone with slight harmonics for more urgency
        let sample = Math.sin(2 * Math.PI * freq * t) * 0.7;
        sample += Math.sin(2 * Math.PI * freq * 2 * t) * 0.2; // 2nd harmonic
        sample += Math.sin(2 * Math.PI * freq * 3 * t) * 0.1; // 3rd harmonic

        // Apply volume
        sample *= volume;

        // Clip to prevent distortion
        sample = Math.max(-1, Math.min(1, sample));

        samples.push(sample);
    }

    return samples;
}

// Convert samples to 16-bit PCM
function samplesToInt16(samples) {
    const buffer = Buffer.alloc(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        const int16 = Math.floor(sample * 32767);
        buffer.writeInt16LE(int16, i * 2);
    }
    return buffer;
}

// Create WAV file
function createWavFile(samples, outputPath) {
    const pcmData = samplesToInt16(samples);
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;

    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);

    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    const wavBuffer = Buffer.concat([header, pcmData]);
    fs.writeFileSync(outputPath, wavBuffer);

    return wavBuffer.length;
}

// Generate and save
console.log('Generating LOUD 1-second alarm siren...');

const totalSamples = sampleRate * duration;
const samples = generateSiren(totalSamples);

const outputDir = path.join(__dirname, '..', 'public', 'assets', 'audio');
const wavPath = path.join(outputDir, 'alarm.wav');

const fileSize = createWavFile(samples, wavPath);
console.log(`  Created: alarm.wav (${duration}s, ${(fileSize/1024).toFixed(1)} KB)`);

// Copy as .mp3 extension for compatibility (browser will still play WAV content)
fs.copyFileSync(wavPath, path.join(outputDir, 'alarm.mp3'));
console.log('  Copied as: alarm.mp3');

console.log('\n✓ Done! Loud 1-second siren that loops.');
