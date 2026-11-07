#!/usr/bin/env python3
"""Execute verification gates and atomically emit sanitized, process-derived evidence."""
import hashlib
import json
import os
import re
import subprocess
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.app.intent_parser import parse_intent  # noqa: E402


def sanitize_log(content: str) -> str:
    for pattern in (
        r'(?i)(?:api[_-]?key|secret|token|password|authorization|auth)\s*[:=]\s*[^\r\n]+',
        r'(?i)\bBearer\s+\S+',
        r'\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]+',
        r'(?s)-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----',
        r'(?i)https?://[^\s/:]+:[^\s/@]+@',
    ):
        content = re.sub(pattern, '[REDACTED]', content)
    return content


def commands() -> dict[str, list[str]]:
    return {
        'python-lint': [sys.executable, '-m', 'ruff', 'check', 'backend', 'scripts', 'tests'],
        'python-types': [sys.executable, '-m', 'mypy', 'backend/app'],
        'gate-evaluator-unit': [sys.executable, '-m', 'pytest', '-q'],
        'frontend-lint': ['npm', '--prefix', 'frontend', 'run', 'lint'],
        'frontend-types': ['npm', '--prefix', 'frontend', 'run', 'type-check'],
        'portal-ui-e2e': ['npm', '--prefix', 'frontend', 'run', 'test:ci'],
        'frontend-build': ['npm', '--prefix', 'frontend', 'run', 'build'],
        'npm-bom': ['npm', '--prefix', 'frontend', 'run', 'bom'],
        'secret-scan': [sys.executable, 'scripts/scan_secrets.py'],
        'maritime-preflight': ['npm', '--prefix', 'frontend', 'run', 'demo:preflight'],
        'maritime-controller': ['node', '--test', 'frontend/support/maritime/controller.test.mjs'],
        'maritime-typecheck': ['npm', '--prefix', 'frontend', 'run', 'test:maritime:type-check'],
        'maritime-offline-sync': ['npm', '--prefix', 'frontend', 'run', 'test:maritime:demo'],
    }


def run_check(check_id: str, command: list[str], root: Path, output: Path,
              timeout: float = 300) -> dict[str, Any]:
    code = None
    try:
        process = subprocess.run(command, cwd=root, capture_output=True, text=True,
                                 errors='replace', timeout=timeout, check=False)
        code = process.returncode
        text = f'Exit code: {code}\nSTDOUT:\n{process.stdout}\nSTDERR:\n{process.stderr}'
    except subprocess.TimeoutExpired as error:
        text = f'Execution timed out.\n{error.stdout or b""}\n{error.stderr or b""}'
    except OSError as error:
        text = f'Execution error: {error}'
    path = output / f'{check_id}.log'
    content = sanitize_log(text).encode('utf-8')
    path.write_bytes(content)
    path.chmod(0o644)
    return {'check_id': check_id, 'name': check_id.replace('-', ' ').title(),
            'description': ' '.join(command), 'command': command,
            'status': 'passed' if code == 0 else 'failed', 'exit_code': code,
            'details': 'Check executed successfully.' if code == 0 else 'Check failed. Inspect log.',
            'log_path': path.relative_to(root).as_posix(),
            'log_sha256': hashlib.sha256(content).hexdigest()}


def main() -> int:
    intent_path = ROOT / 'intent.md'
    intent_content = intent_path.read_text(encoding='utf-8')
    definitions = parse_intent(intent_content)
    evidence = ROOT / '.adlc/evidence'
    output = evidence / 'runs' / uuid.uuid4().hex
    output.mkdir(parents=True, exist_ok=False)
    for directory in (evidence, evidence / 'runs', output):
        directory.chmod(0o755)
    results = []
    for check_id, command in commands().items():
        print(f'Running {check_id}: {" ".join(command)}', flush=True)
        record = run_check(check_id, command, ROOT, output)
        results.append(record)
        print(f'  {record["status"]} (exit {record["exit_code"]})', flush=True)
    by_id = {record['check_id']: record for record in results}
    tasks = []
    for definition in definitions:
        checks = [by_id.get(check_id, {'check_id': check_id, 'name': check_id,
                  'description': 'Not implemented in these slices', 'status': 'pending',
                  'details': 'No execution configured. No completion is claimed.', 'log_path': None})
                  for check_id in definition.required_checks]
        build = by_id.get('frontend-build', {}).get('exit_code')
        implemented = definition.task_id in {'task-dashboard', 'maritime-demo'}
        tasks.append({'task_id': definition.task_id, 'title': definition.title,
                      'summary': definition.summary, 'required_checks': checks,
                      'stages': {
                          'intent': {'state': 'ready', 'subtext': 'From intent.md'},
                          'plan': {'state': 'planned' if implemented else 'pending', 'subtext': 'Tests defined' if implemented else 'Not started'},
                          'build': {'state': ('built' if build == 0 else 'failed') if implemented else 'pending', 'subtext': 'Build successful' if implemented and build == 0 else 'Not started'},
                          'release': {'state': 'pending', 'subtext': 'Awaiting release' if implemented else 'Not started'},
                      }})
    git = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True,
                         text=True, check=False)
    manifest = {'schema_version': '1.0', 'repo': os.getenv('GITHUB_REPOSITORY', 'bmifsud/POC-Maritime-logistics-SaaS'),
                'commit_sha': git.stdout.strip() if git.returncode == 0 else None,
                'intent_sha256': hashlib.sha256(intent_content.encode()).hexdigest(),
                'synced_at': datetime.now(UTC).isoformat(), 'tasks': tasks,
                'verification_runs': results, 'working_tree_dirty': bool(subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT, capture_output=True, text=True, check=False).stdout.strip()), 'assurance': 'Local unsigned execution evidence'}
    temporary = output / 'manifest.json'
    temporary.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    temporary.chmod(0o644)
    os.replace(temporary, evidence / 'manifest.json')
    passed = all(result['exit_code'] == 0 for result in results)
    print('Evidence recorded. ' + ('All checks passed.' if passed else 'Verification blocked.'))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
