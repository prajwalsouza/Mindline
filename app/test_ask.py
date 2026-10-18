"""Offline checks for cached answers, cancellation, and model output validation."""
import json
import sys
import tempfile
import time
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'data-prep' / 'simulator'))
import ask


class AskTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.cache = patch.object(ask, 'CACHE', Path(self.temp.name) / 'cache.json')
        self.cache.start(); self.addCleanup(self.cache.stop)
        self.jobs = patch.object(ask, 'JOBS', {})
        self.jobs.start(); self.addCleanup(self.jobs.stop)

    def test_cache_only_never_launches_a_process(self):
        with patch.object(ask, 'MODE', 'cache'), patch.object(ask, 'codex_bin') as exe:
            self.assertEqual(ask.ask('A new question')['status'], 'nocache')
            exe.assert_not_called()

    def test_cache_keeps_the_answer_date(self):
        ask.remember('What changed?', [{'t': 'text', 'md': 'One change.'}], '', 'test', 1, date(2026, 9, 27))
        with patch.object(ask.FEED, 'today', date(2026, 11, 1)):
            result = ask.ask('WHAT CHANGED?')
        self.assertTrue(result['cached'])
        self.assertEqual(result['asof'], '2026-09-27')
        self.assertEqual(ask.cached('What changed?')['asked'], 2)
        self.assertEqual(ask.suggest('what ch'), ['What changed?'])

    def test_invalid_question_has_explicit_error(self):
        for question in (' ', None, 123, {}):
            self.assertEqual(ask.ask(question)['status'], 'error')

    def test_stop_kills_process_and_is_idempotent(self):
        proc = Mock()
        j = {'id': 'a', 'q': 'Q', 'model': 'test', 'status': 'running', 'started': time.time(), 'proc': proc}
        ask.JOBS['a'] = j
        self.assertEqual(ask.stop('a')['status'], 'stopped')
        ask.stop('a')
        proc.kill.assert_called_once()
        self.assertNotIn('proc', ask.job('a'))

    def test_stop_during_digest_prevents_launch(self):
        j = {'id': 'a', 'q': 'Q', 'model': 'test', 'status': 'running', 'started': time.time(), 'asof': '2026-09-27'}
        def digest(_):
            ask._cancel(j)
            return {}, {}
        with patch.object(ask, '_digest', side_effect=digest), patch.object(ask, 'codex_bin', return_value='codex'), patch.object(ask.subprocess, 'Popen') as launch:
            ask._run(j)
        launch.assert_not_called()
        self.assertEqual(j['status'], 'stopped')
        self.assertFalse(ask.CACHE.exists())

    def test_timeout_has_terminal_status(self):
        j = {'status': 'running', 'proc': Mock()}
        ask._cancel(j, 'error', 'Timed out')
        self.assertEqual(j['status'], 'error')
        self.assertEqual(j['error'], 'Timed out')
        j['proc'].kill.assert_called_once()

    def test_bad_model_blocks_do_not_become_charts(self):
        blocks = ask.parse_lines('bad json\n{"t":"viz","c":"invented"}\n{"t":"text","md":"Hello"}\n{"t":"viz","c":"trend","p":{"drug":"fake"}}')
        with patch.object(ask.FEED, 'view', return_value={'wards': {'URO': {}}}) as view:
            result = ask.resolve([None, 3] + blocks, {}, date(2026, 9, 27))
        self.assertEqual(result, [{'t': 'text', 'md': 'Hello'}])
        view.assert_called_once_with(date(2026, 9, 27))

    def test_parallel_requests_are_bounded(self):
        for i in range(ask.MAX_RUNNING):
            ask.JOBS[str(i)] = {'id': str(i), 'q': str(i), 'status': 'running', 'asof': '2026-09-27'}
        with patch.object(ask, 'MODE', 'live'), patch.object(ask, 'codex_bin', return_value='codex'), patch.object(ask.FEED, 'ensure'):
            self.assertEqual(ask.ask('another')['status'], 'error')
            self.assertEqual(ask.ask('0')['id'], '0')


if __name__ == '__main__':
    unittest.main()
