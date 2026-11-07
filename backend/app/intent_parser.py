"""Parse the explicit task definitions in intent.md, independent of HTTP/storage."""
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class IntentTask:
    task_id: str
    title: str
    summary: str
    required_checks: tuple[str, ...]


TASK = re.compile(
    r'^- \*\*Task \d+ \(`(?P<id>[a-z0-9_-]+)`\):\*\* '
    r'(?P<title>.+?) — (?P<summary>.+?) Required checks: (?P<checks>.+?)\.$', re.MULTILINE
)


def parse_intent(text: str) -> list[IntentTask]:
    tasks = []
    for match in TASK.finditer(text):
        raw = match['checks']
        if not re.fullmatch(r'`[a-z0-9_-]+`(?:,\s*`[a-z0-9_-]+`)*', raw):
            raise ValueError('Invalid required check identifiers')
        checks = tuple(re.findall(r'`([^`]+)`', raw))
        if len(checks) != len(set(checks)):
            raise ValueError('Duplicate required check identifiers')
        tasks.append(IntentTask(match['id'], match['title'], match['summary'], checks))
    if not tasks or len({task.task_id for task in tasks}) != len(tasks):
        raise ValueError('Intent must contain unique, explicit task definitions')
    definitions = [line for line in text.splitlines() if line.startswith('- **Task ')]
    if len(definitions) != len(tasks):
        raise ValueError('Malformed intent task definition')
    return tasks
