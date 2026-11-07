"""Read-only HTTP adapter for intent, evidence validation, and snapshot persistence."""
import hashlib
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .evaluator import evaluate_task
from .evidence_reader import EvidenceReader, UnsafeEvidence
from .intent_parser import IntentTask, parse_intent
from .store import SnapshotStore


class Record(BaseModel):
    model_config = ConfigDict(extra='allow')


class Check(Record):
    check_id: str = Field(pattern=r'^[a-zA-Z0-9_-]+$')
    name: str
    description: str
    status: str
    details: str
    log_path: str | None = None


class Stage(Record):
    state: str
    subtext: str


class Task(Record):
    task_id: str
    title: str
    summary: str
    stages: dict[str, Stage]
    required_checks: list[Check]


class Manifest(Record):
    schema_version: str = Field(pattern=r'^1\.0$')
    repo: str
    commit_sha: str | None
    intent_sha256: str
    synced_at: str
    tasks: list[Task]


def create_app(root: Path | None = None, *, static_dir: Path | None = None) -> FastAPI:
    root = (root or Path(os.getenv('ADLC_ROOT', Path(__file__).resolve().parents[2]))).resolve()
    application = FastAPI(title='ADLC Supervision Portal', version='1.0.0')
    reader = EvidenceReader(root)
    # Initialize persistence lazily so imports have no filesystem side effects.
    def store() -> SnapshotStore:
        return SnapshotStore(Path(os.getenv('ADLC_STATE_DIR', root / '.adlc')) / 'portal.sqlite3')

    def evaluate(data: dict[str, Any], definitions: list[IntentTask]) -> dict[str, Any]:
        tasks = {task['task_id']: task for task in data['tasks']}
        if len(tasks) != len(data['tasks']):
            raise ValueError('Duplicate task records')
        evaluated = []
        for definition in definitions:
            task = tasks.get(definition.task_id, {
                'task_id': definition.task_id, 'title': definition.title, 'summary': definition.summary,
                'stages': {'build': {'state': 'pending', 'subtext': 'Not started'}},
                'required_checks': [],
            })
            evaluated.append(evaluate_task(task, definition, reader))
        return {**data, 'tasks': evaluated}

    def status() -> dict[str, Any]:
        diagnostics = []
        data = None
        definitions = None
        intent_text = ''
        try:
            intent_text = (root / 'intent.md').read_text(encoding='utf-8')
            definitions = parse_intent(intent_text)
        except (OSError, ValueError):
            diagnostics.append({'code': 'invalid_intent', 'message': 'Intent definitions unavailable or malformed.'})
        try:
            raw = (root / '.adlc/evidence/manifest.json').read_text(encoding='utf-8')
            data = Manifest.model_validate(json.loads(raw)).model_dump()
        except FileNotFoundError:
            diagnostics.append({'code': 'missing_manifest', 'message': 'Run python scripts/emit_evidence.py.'})
        except (OSError, ValueError, ValidationError):
            diagnostics.append({'code': 'invalid_manifest', 'message': 'Evidence manifest is malformed.'})
        fallback = False
        try:
            if diagnostics:
                previous = store().load()
                if (previous is None and definitions is not None
                        and os.getenv('ADLC_PREVIEW_MODE') == '1'
                        and [d['code'] for d in diagnostics] == ['missing_manifest']):
                    # Review-only empty state, not an execution manifest or a passed claim.
                    pending = evaluate({'tasks': []}, definitions)
                    pending.update(repo='bmifsud/ADLC-PORTAL', commit_sha=None,
                                   synced_at=datetime.now(UTC).isoformat(),
                                   diagnostics=diagnostics, snapshot='unverified',
                                   connection='Review preview · no execution evidence',
                                   intent_current=False)
                    return pending
                if previous is None:
                    code = 404 if any(d['code'] == 'missing_manifest' for d in diagnostics) else 422
                    raise HTTPException(code, {'diagnostics': diagnostics})
                data, previous_intent = previous
                definitions = parse_intent(previous_intent)
                fallback = True
            assert data is not None and definitions is not None
            result = evaluate(data, definitions)
            if not fallback:
                store().save(data, intent_text)
            current_hash = hashlib.sha256((root / 'intent.md').read_bytes()).hexdigest() if (root / 'intent.md').is_file() else None
            result.update(diagnostics=diagnostics, snapshot='last_valid' if fallback else 'current',
                          connection='Local repo synced', intent_current=current_hash == data['intent_sha256'])
            return result
        except UnsafeEvidence as error:
            raise HTTPException(error.status_code, str(error)) from None
        except ValueError:
            raise HTTPException(422, 'Invalid task/check records') from None

    @application.get('/api/v1/health')
    def health() -> dict[str, str]:
        return {'status': 'healthy', 'service': 'adlc-supervision-portal'}

    @application.get('/api/v1/portal/status')
    def portal_status() -> dict[str, Any]:
        return status()

    @application.get('/api/v1/portal/logs/{check_id}', response_class=PlainTextResponse)
    def log(check_id: str) -> PlainTextResponse:
        if not re.fullmatch(r'[a-zA-Z0-9_-]+', check_id):
            raise HTTPException(400, 'Invalid check identifier')
        data = status()
        checks = [check for task in data['tasks'] for check in task['required_checks']
                  if check['check_id'] == check_id]
        if not checks or not checks[0].get('log_path'):
            raise HTTPException(404, 'Evidence log unavailable')
        try:
            return PlainTextResponse(reader.read(checks[0]['log_path']))
        except UnsafeEvidence as error:
            raise HTTPException(error.status_code, str(error)) from None
        except (OSError, UnicodeError):
            raise HTTPException(404, 'Evidence log unavailable') from None

    static_dir = static_dir or root / 'frontend/dist'
    if static_dir.is_dir():
        application.mount('/', StaticFiles(directory=static_dir, html=True), name='frontend')
    return application


app = create_app()
