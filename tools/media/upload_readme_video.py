"""Upload the finished README video, scoped to the existing private repository.

Protocol: github.com/cli/cli/blob/trunk/internal/attachments/client.go
No issue or comment is created. Credentials remain in memory.
"""
import json
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPOSITORY = 'prajwalsouza/Mindline'


def main():
    path = ROOT / 'docs/media/mindline-demo.mp4'
    repo = json.loads(subprocess.check_output(['gh', 'api', 'repos/' + REPOSITORY]))
    if not repo['private'] or not repo.get('permissions', {}).get('push'):
        raise RuntimeError('Expected the private Mindline repository with write access')
    if not path.is_file() or path.stat().st_size > 10 * 1024 * 1024:
        raise RuntimeError('Expected a finished video under 10 MiB')
    token = subprocess.check_output(['gh', 'auth', 'token'], text=True).strip()
    url = 'https://uploads.github.com/user-attachments/assets?' + urllib.parse.urlencode({
        'name': path.name, 'content_type': 'video/mp4', 'repository_id': repo['id']})
    request = urllib.request.Request(url, data=path.read_bytes(), method='POST', headers={
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/octet-stream',
        'Accept': 'application/vnd.github+json', 'User-Agent': 'Mindline-media'})
    with urllib.request.urlopen(request, timeout=180) as response:
        asset = json.load(response)
    if not asset.get('url', '').startswith('https://github.com/user-attachments/'):
        raise RuntimeError('Unexpected attachment response')
    (ROOT / 'docs/media/video-attachment.json').write_text(json.dumps({
        'repository': REPOSITORY, 'visibility': 'private', 'url': asset['url']}, indent=2) + '\n')
    print(asset['url'])


if __name__ == '__main__':
    main()
