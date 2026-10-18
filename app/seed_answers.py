"""Generate the seven saved demo answers with the configured Codex model.

    python app/seed_answers.py [--refresh]

Explicit development command; ordinary app startup never launches a model.
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'data-prep' / 'simulator'))
import ask

QUESTIONS = [
    'Is trimethoprim still a good choice for urine infections here?',
    'Which ward is above its usual number of resistant cases?',
    'Are there more resistant results, or just more samples?',
    'Does resistance to one drug still predict resistance to another?',
    'Is last month a better guide than last year?',
    'Could a quiet week mean missing data?',
    'Does the patient group change the resistance figures?',
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    ask.MODE = 'live'
    if not ask.codex_bin(): raise SystemExit('Set MINDLINE_CODEX to the Codex executable first.')
    for q in QUESTIONS:
        if args.refresh: ask.forget(ask.norm(q))
        result = ask.ask(q)
        while result['status'] == 'running':
            time.sleep(.5)
            result = ask.job(result['id'])
        if result['status'] != 'done': raise RuntimeError(result)
        print(json.dumps({'q': q, 'asof': result['asof'], 'text': [b['md'] for b in result['blocks'] if b['t'] == 'text'],
                          'charts': [b['c'] for b in result['blocks'] if b['t'] == 'viz']}, ensure_ascii=True), flush=True)


if __name__ == '__main__':
    main()
