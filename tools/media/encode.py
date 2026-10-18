"""Encode timestamped browser frames from the current film with original music."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILD = Path(__file__).resolve().parent / 'build'
OUT = ROOT / 'docs/media/mindline-demo.mp4'
DURATION = 100.0


def main():
    capture = json.loads((BUILD / 'capture.json').read_text())
    frames = capture['frames']
    if len(frames) < 500:
        raise RuntimeError('Expected animated frame capture, not a still slideshow')
    lines = ['ffconcat version 1.0']
    durations = [((frames[i+1]['seconds'] - f['seconds']) if frames[i+1]['seconds'] - f['seconds'] <= 1 else .12) for i, f in enumerate(frames[:-1])] + [2.0]
    duration = sum(durations)
    origin = frames[0]['seconds']
    for i, frame in enumerate(frames):
        start = frame['seconds'] - origin
        end = frames[i + 1]['seconds'] - origin if i + 1 < len(frames) else DURATION
        if start >= DURATION:
            break
        path = (BUILD / frame['file']).resolve().as_posix()
        lines.extend([f"file '{path}'", f'duration {durations[i]:.6f}'])
    lines.append(f"file '{(BUILD / frames[-1]['file']).resolve().as_posix()}'")
    playlist = BUILD / 'frames.ffconcat'
    playlist.write_text('\n'.join(lines) + '\n')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['C:/otherlibs/ffmpeg.exe', '-hide_banner', '-loglevel', 'warning', '-y',
        '-safe', '0', '-f', 'concat', '-i', str(playlist),
        '-i', str(ROOT / 'app/static/demo-v2/assets/mindline-v2-instrumental.mp3'),
        '-vf', 'fps=24,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xfbfaf7,format=yuv420p',
        '-af', f'afade=t=in:d=0.7,afade=t=out:st={max(0,duration-2):.3f}:d=2',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-maxrate', '620k', '-bufsize', '1240k',
        '-c:a', 'aac', '-b:a', '96k', '-t', str(duration), '-movflags', '+faststart', str(OUT)], check=True)
    result = json.loads(subprocess.check_output(['C:/otherlibs/ffprobe.exe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(OUT)]))
    summary = {'duration_seconds': float(result['format']['duration']), 'bytes': OUT.stat().st_size,
               'source': 'Current app/static/demo film', 'captured_frames': len(frames),
               'streams': [{'codec': s['codec_name'], 'type': s['codec_type'], 'width': s.get('width'), 'height': s.get('height')}
                           for s in result['streams']]}
    (ROOT / 'docs/media/video-metadata.json').write_text(json.dumps(summary, indent=2) + '\n')
    if summary['duration_seconds'] > 120 or summary['bytes'] > 10 * 1024 * 1024:
        raise RuntimeError('Video exceeds the requested duration or attachment size')
    print(json.dumps(summary))


if __name__ == '__main__':
    main()
