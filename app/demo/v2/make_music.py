"""Extend the existing original synthesis to 106 seconds, leaving V1 intact."""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
source = (ROOT / 'tools/media/score.py').read_text(encoding='utf-8').split('if __name__ == "__main__":')[0]
# The existing composition is 2 seconds per bar. Retain its notes and synthesis,
# extend the middle, and move the resolving bars and fade to the new ending.
source = source.split('\ndef cut():')[0]
source = source.replace('SECONDS = 60', 'SECONDS = 106').replace('range(30)', 'range(53)')
source = source.replace('bar < 28', 'bar < 51').replace('bar < 26', 'bar < 49')
source = source.replace("BUILD = HERE/'build'", "BUILD = pathlib.Path(BUILD_PATH)")
with tempfile.TemporaryDirectory(prefix='mindline-v2-score-') as tmp:
    env = {'__file__': str(ROOT / 'tools/media/score.py'), 'BUILD_PATH': tmp}
    exec(compile(source, 'mindline_v2_score', 'exec'), env)
    wav = env['score']()
    output = ROOT / 'app/static/demo-v2/assets/mindline-v2-instrumental.mp3'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', str(wav), '-af', 'loudnorm=I=-20:TP=-2:LRA=9',
                    '-c:a', 'libmp3lame', '-b:a', '160k', str(output)], check=True)
    print(output)
