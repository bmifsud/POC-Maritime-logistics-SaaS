"""Slice 1 acceptance tests. Written before the implementation modules exist."""
import copy
import importlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

INTENT = '''# Intent
## Initial Monitored Tasks
- **Task 1 (`backup-restore`):** Backup restore — Restore and verify data. Required checks: `encrypted-upload`, `restore-test`.
'''


@pytest.fixture
def workspace(tmp_path):
    (tmp_path / 'intent.md').write_text(INTENT)
    evidence = tmp_path / '.adlc/evidence'
    evidence.mkdir(parents=True)
    checks = []
    for check_id in ('encrypted-upload', 'restore-test'):
        (evidence / f'{check_id}.log').write_text('Actual test output\n')
        checks.append({'check_id': check_id, 'name': check_id, 'description': 'Check',
                       'status': 'passed', 'details': 'Completed',
                       'log_path': f'.adlc/evidence/{check_id}.log'})
    manifest = {'schema_version': '1.0', 'repo': 'test/repo', 'commit_sha': 'abc123',
                'intent_sha256': 'test', 'synced_at': '2026-11-02T00:00:00Z',
                'tasks': [{'task_id': 'backup-restore', 'title': 'Backup restore',
                           'summary': 'Restore and verify data.',
                           'stages': {'build': {'state': 'built', 'subtext': 'Build successful'},
                                      'verify': {'state': 'passed', 'subtext': 'Agent claim'}},
                           'required_checks': checks}]}
    return tmp_path, manifest


def write_manifest(root, manifest):
    # Test fixture only, isolated from the repository's emitter-owned evidence.
    (root / '.adlc/evidence/manifest.json').write_text(json.dumps(manifest))


def evaluate(workspace):
    root, manifest = workspace
    reader = importlib.import_module('backend.app.evidence_reader')
    evaluator = importlib.import_module('backend.app.evaluator')
    parser = importlib.import_module('backend.app.intent_parser')
    expected = parser.parse_intent((root / 'intent.md').read_text())
    return evaluator.evaluate_task(manifest['tasks'][0], expected[0], reader.EvidenceReader(root))


def client_for(root):
    return TestClient(importlib.import_module('backend.app.main').create_app(root))


def test_all_required_checks_pass_with_nonempty_logs(workspace):
    task = evaluate(workspace)
    assert task['stages']['verify'] == {'state': 'passed', 'subtext': 'All checks green'}


@pytest.mark.parametrize('missing', ['record', 'null-path', 'file', 'empty', 'all-records'])
def test_missing_evidence_blocks_built_task(workspace, missing):
    root, manifest = workspace
    checks = manifest['tasks'][0]['required_checks']
    if missing == 'record':
        checks.pop()
    elif missing == 'null-path':
        checks[1]['log_path'] = None
    elif missing == 'file':
        (root / checks[1]['log_path']).unlink()
    elif missing == 'empty':
        (root / checks[1]['log_path']).write_text(' \n')
    else:
        checks.clear()
    task = evaluate(workspace)
    assert task['stages']['verify'] == {'state': 'blocked', 'subtext': 'Missing evidence'}
    assert any(c['status'] == 'missing_evidence' and c['log_path'] is None
               for c in task['required_checks'])


def test_agent_verify_claim_is_ignored(workspace):
    workspace[1]['tasks'][0]['required_checks'][0]['status'] = 'failed'
    assert evaluate(workspace)['stages']['verify'] == {'state': 'blocked', 'subtext': 'Check failed'}


@pytest.mark.parametrize('build_state', ['pending', 'failed'])
def test_unbuilt_task_is_pending(workspace, build_state):
    workspace[1]['tasks'][0]['stages']['build']['state'] = build_state
    assert evaluate(workspace)['stages']['verify'] == {'state': 'pending', 'subtext': 'Not started'}


@pytest.mark.parametrize('bad_path', [
    '.adlc/evidence/../evidence/restore-test.log',
    '../outside.log',
    '/tmp/outside.log',
    '.adlc/evidence-sibling/outside.log',
    '.adlc/evidence/manifest.json',
    '.adlc/evidence/restore..test.log',
])
@pytest.mark.parametrize('route', ['/api/v1/portal/status', '/api/v1/portal/logs/restore-test'])
def test_http_rejects_unsafe_log_paths(workspace, bad_path, route):
    root, manifest = workspace
    manifest['tasks'][0]['required_checks'][1]['log_path'] = bad_path
    write_manifest(root, manifest)
    with client_for(root) as client:
        assert client.get(route).status_code in (400, 403)


def test_http_rejects_symlink_escape(workspace):
    root, manifest = workspace
    outside = root / 'outside.log'
    outside.write_text('Private content')
    target = root / '.adlc/evidence/restore-test.log'
    target.unlink()
    target.symlink_to(outside)
    write_manifest(root, manifest)
    with client_for(root) as client:
        assert client.get('/api/v1/portal/logs/restore-test').status_code == 403
        assert client.get('/api/v1/portal/status').status_code == 403


def test_logs_are_plain_text(workspace):
    root, manifest = workspace
    write_manifest(root, manifest)
    with client_for(root) as client:
        response = client.get('/api/v1/portal/logs/restore-test')
        assert response.status_code == 200
        assert response.headers['content-type'] == 'text/plain; charset=utf-8'
        assert response.text == 'Actual test output\n'
        assert client.get('/api/v1/portal/logs/unknown').status_code == 404


def test_status_fills_missing_records_from_intent(workspace):
    root, manifest = workspace
    manifest['tasks'][0]['required_checks'].pop()
    write_manifest(root, manifest)
    with client_for(root) as client:
        data = client.get('/api/v1/portal/status').json()
        task = data['tasks'][0]
        assert task['stages']['verify']['state'] == 'blocked'
        missing = next(c for c in task['required_checks'] if c['check_id'] == 'restore-test')
        assert missing['status'] == 'missing_evidence'
        assert missing['log_path'] is None
        assert 'No verification output found.' in missing['details']


def test_evaluator_does_not_mutate_input(workspace):
    original = copy.deepcopy(workspace[1])
    evaluate(workspace)
    assert workspace[1] == original


def test_sqlite_wal_and_last_valid_snapshot(workspace):
    root, manifest = workspace
    write_manifest(root, manifest)
    with client_for(root) as client:
        good = client.get('/api/v1/portal/status')
        assert good.status_code == 200
        (root / '.adlc/evidence/manifest.json').write_text('{broken')
        fallback = client.get('/api/v1/portal/status')
        assert fallback.status_code == 200
        assert fallback.json()['tasks'] == good.json()['tasks']
        assert fallback.json()['diagnostics'][0]['code'] == 'invalid_manifest'
    import sqlite3
    with sqlite3.connect(root / '.adlc/portal.sqlite3') as connection:
        assert connection.execute('PRAGMA journal_mode').fetchone()[0] == 'wal'
    # The last valid snapshot must survive process/app recreation.
    with client_for(root) as client:
        assert client.get('/api/v1/portal/status').json()['tasks'] == good.json()['tasks']


def test_malformed_intent_retains_snapshot(workspace):
    root, manifest = workspace
    write_manifest(root, manifest)
    with client_for(root) as client:
        assert client.get('/api/v1/portal/status').status_code == 200
        (root / 'intent.md').write_text('Invalid task definitions')
        response = client.get('/api/v1/portal/status')
        assert response.status_code == 200
        assert response.json()['diagnostics'][0]['code'] == 'invalid_intent'


def test_snapshot_never_bypasses_disk_evidence_validation(workspace):
    root, manifest = workspace
    write_manifest(root, manifest)
    with client_for(root) as client:
        assert client.get('/api/v1/portal/status').status_code == 200
        (root / '.adlc/evidence/manifest.json').write_text('{broken')
        (root / '.adlc/evidence/restore-test.log').unlink()
        response = client.get('/api/v1/portal/status')
        assert response.json()['tasks'][0]['stages']['verify']['state'] == 'blocked'


def test_parse_repository_intent():
    parser = importlib.import_module('backend.app.intent_parser')
    root = Path(__file__).resolve().parents[1]
    tasks = parser.parse_intent((root / 'intent.md').read_text())
    assert [t.task_id for t in tasks] == ['bridge-reconnect', 'backup-restore', 'task-dashboard']
    assert tasks[1].required_checks == ('encrypted-upload', 'restore-test')


@pytest.mark.parametrize('text', ['', 'No tasks', INTENT + INTENT, INTENT.replace('`restore-test`', '`encrypted-upload`')])
def test_parser_rejects_invalid_definitions(text):
    parser = importlib.import_module('backend.app.intent_parser')
    with pytest.raises(ValueError):
        parser.parse_intent(text)


def test_fresh_review_service_shows_pending_without_fabricating_evidence(tmp_path, monkeypatch):
    monkeypatch.setenv('ADLC_PREVIEW_MODE', '1')
    (tmp_path / 'intent.md').write_text(INTENT)
    with client_for(tmp_path) as client:
        response = client.get('/api/v1/portal/status')
        assert response.status_code == 200
        data = response.json()
        assert data['tasks'][0]['stages']['verify']['state'] == 'pending'
        assert data['tasks'][0]['stages']['build']['state'] == 'pending'
        assert data['diagnostics'][0]['code'] == 'missing_manifest'
        assert not (tmp_path / '.adlc/evidence/manifest.json').exists()
