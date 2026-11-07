import importlib
import json
import sys

import pytest


def test_emitter_records_real_exit_and_redacts_output(tmp_path):
    emitter = importlib.import_module('scripts.emit_evidence')
    result = emitter.run_check('failed', [sys.executable, '-c', "print('password=' + 'private-value-123'); raise SystemExit(7)"], tmp_path, tmp_path)
    assert result['exit_code'] == 7 and result['status'] == 'failed'
    assert 'private-value-123' not in (tmp_path / 'failed.log').read_text()
    assert '[REDACTED]' in (tmp_path / 'failed.log').read_text()


def test_emitter_success_depends_on_process_exit(tmp_path):
    emitter = importlib.import_module('scripts.emit_evidence')
    result = emitter.run_check('passed', [sys.executable, '-c', 'print("Executed")'], tmp_path, tmp_path)
    assert result['status'] == 'passed' and result['exit_code'] == 0
    assert (tmp_path / 'passed.log').stat().st_size > 0


def test_emitter_timeout_is_failed(tmp_path):
    emitter = importlib.import_module('scripts.emit_evidence')
    result = emitter.run_check('timeout', [sys.executable, '-c', 'import time; time.sleep(5)'], tmp_path, tmp_path, timeout=.05)
    assert result['status'] == 'failed' and result['exit_code'] is None


def test_secret_scanner_blocks_tokens_without_printing_values(tmp_path, capsys):
    scanner = importlib.import_module('scripts.scan_secrets')
    value = 'ghp_' + 'a' * 36
    (tmp_path / 'bad.txt').write_text(value)
    assert scanner.scan(tmp_path) == 1
    assert value not in capsys.readouterr().out
    (tmp_path / 'bad.txt').write_text('No credentials here')
    assert scanner.scan(tmp_path) == 0


def test_built_frontend_and_health_served_together(tmp_path):
    from backend.app.main import create_app
    from fastapi.testclient import TestClient
    static = tmp_path / 'dist'
    static.mkdir()
    (static / 'index.html').write_text('<title>Progress</title>')
    with TestClient(create_app(tmp_path, static_dir=static)) as client:
        assert client.get('/').text == '<title>Progress</title>'
        assert client.get('/api/v1/health').status_code == 200
        assert client.get('/api/v1/unknown').status_code == 404


def test_compose_evidence_is_readonly():
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    compose = (root / 'docker-compose.yml').read_text()
    assert './.adlc/evidence:/app/.adlc/evidence:ro' in compose
    dockerfile = (root / 'Dockerfile').read_text()
    assert all('@sha256:' in line for line in dockerfile.splitlines() if line.startswith('FROM '))


def test_emitter_manifest_uses_intent_tasks(tmp_path, monkeypatch):
    emitter = importlib.import_module('scripts.emit_evidence')
    (tmp_path / 'intent.md').write_text('- **Task 1 (`task-dashboard`):** Task dashboard — Portal. Required checks: `gate-evaluator-unit`, `portal-ui-e2e`.\n')
    # Exercise manifest assembly with actual successful child processes, not statuses.
    monkeypatch.setattr(emitter, 'ROOT', tmp_path)
    monkeypatch.setattr(emitter, 'commands', lambda: {
        'gate-evaluator-unit': [sys.executable, '-c', 'print("Unit executed")'],
        'portal-ui-e2e': [sys.executable, '-c', 'print("UI executed")'],
        'frontend-build': [sys.executable, '-c', 'print("Build executed")'],
    })
    assert emitter.main() == 0
    manifest = json.loads((tmp_path / '.adlc/evidence/manifest.json').read_text())
    assert manifest['tasks'][0]['task_id'] == 'task-dashboard'
    assert all(c['exit_code'] == 0 for c in manifest['tasks'][0]['required_checks'])


@pytest.mark.parametrize('content', ['token=' + 'x' * 24, 'Bearer ' + 'x' * 24])
def test_sanitizer_covers_tokens(content):
    emitter = importlib.import_module('scripts.emit_evidence')
    assert 'x' * 24 not in emitter.sanitize_log(content)
