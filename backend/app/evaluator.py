"""Pure verification policy; no HTTP, SQLite, or mutable global state."""
from copy import deepcopy
from typing import Any

from .evidence_reader import EvidenceReader
from .intent_parser import IntentTask


def evaluate_task(task: dict[str, Any], intent: IntentTask,
                  reader: EvidenceReader) -> dict[str, Any]:
    result = deepcopy(task)
    records = result.get('required_checks', [])
    # Validate every supplied path before evaluation, including unbuilt tasks/extras.
    for record in records:
        if record.get('log_path'):
            reader.resolve(record['log_path'])
    ids = [record['check_id'] for record in records]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate check records')
    by_id = {record['check_id']: record for record in records}
    checks = []
    missing = False
    failed = False
    for check_id in intent.required_checks:
        check = by_id.get(check_id, {'check_id': check_id, 'name': check_id,
                                    'description': 'Required by intent.md', 'status': 'missing_evidence',
                                    'details': '', 'log_path': None})
        has_log = False
        if check.get('log_path'):
            try:
                reader.read(check['log_path'])
                has_log = True
            except (OSError, UnicodeError):
                pass
        if not has_log:
            missing = True
            check.update(status='missing_evidence', log_path=None,
                         details=f"No verification output found. {check['name']} did not run or did not produce expected evidence.")
        elif check.get('status') != 'passed' or check.get('exit_code', 0) != 0:
            failed = True
            check['status'] = 'failed'
        checks.append(check)
    result['required_checks'] = checks
    stages = result.setdefault('stages', {})
    if stages.get('build', {}).get('state') != 'built':
        verify = {'state': 'pending', 'subtext': 'Not started'}
    elif missing:
        verify = {'state': 'blocked', 'subtext': 'Missing evidence'}
    elif failed:
        verify = {'state': 'blocked', 'subtext': 'Check failed'}
    else:
        verify = {'state': 'passed', 'subtext': 'All checks green'}
    stages['verify'] = verify
    return result
