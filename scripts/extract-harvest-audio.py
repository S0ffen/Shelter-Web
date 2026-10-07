"""Cut the user-selected strike from the accurately trimmed 268-280 s reference."""
import array
import hashlib
import json
import pathlib
import wave

root = pathlib.Path(__file__).resolve().parent.parent
with wave.open(str(root / 'verification/audio-reference/precise-reference.wav'), 'rb') as source:
    parameters = source.getparams()
    rate, channels = source.getframerate(), source.getnchannels()
    if source.getsampwidth() != 2 or abs(source.getnframes() / rate - 12) > 0.01:
        raise ValueError('Reference must contain exactly 268-280 seconds, without pre-roll.')
    source.setpos(round((273.75 - 268) * rate))
    raw = source.readframes(round(0.55 * rate))

values = array.array('h', raw)
fade_frames = round(rate * 0.002)
for frame in range(fade_frames):
    gain = frame / (fade_frames - 1)
    for channel in range(channels):
        index = frame * channels + channel
        values[index] = round(values[index] * gain)
        index = len(values) - (frame + 1) * channels + channel
        values[index] = round(values[index] * gain)
encoded = values.tobytes()
edge_bytes = fade_frames * channels * 2
assert raw[edge_bytes:-edge_bytes] == encoded[edge_bytes:-edge_bytes]
output = root / 'verification/audio-reference/video-harvest-reference.wav'
output.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(output), 'wb') as destination:
    destination.setparams(parameters)
    destination.writeframes(encoded)
report = {
    'video': 'https://www.youtube.com/watch?v=w5bPBMt6yJ4&t=271',
    'sourceStart': 273.75, 'sourceEnd': 274.30,
    'duration': len(values) / channels / rate, 'sampleRate': rate, 'channels': channels,
    'edgeFadeMs': 2, 'coreUnchanged': True,
    'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
}
(root / 'verification/audio-reference/harvest-extraction.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
