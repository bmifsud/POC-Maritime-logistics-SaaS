"""Local fail-closed pattern scan; report locations and rules, never credential values."""
import re
from pathlib import Path

SKIP = {'.git', '.venv', 'node_modules', 'dist', '.adlc', '.mypy_cache', '.ruff_cache',
        '.pytest_cache', '__pycache__', 'test-results'}
PATTERNS = {
    'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'github-token': re.compile(r'\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,})\b'),
    'openai-token': re.compile(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b'),
    'aws-key': re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'credential-assignment': re.compile(r'''(?i)(?:api[_-]?key|password|secret|access_token)\s*[:=]\s*["']?[A-Za-z0-9_./+!-]{20,}'''),
}


def scan(root: Path) -> int:
    findings = 0
    for path in sorted(root.rglob('*')):
        if any(part in SKIP for part in path.relative_to(root).parts) or not path.is_file():
            continue
        if path.is_symlink():
            print(f'{path.relative_to(root)}: symlink excluded from source scan')
            continue
        try:
            content = path.read_text(encoding='utf-8')
        except UnicodeError:
            continue
        except OSError:
            print(f'{path.relative_to(root)}: unreadable source file')
            findings += 1
            continue
        for rule, pattern in PATTERNS.items():
            for match in pattern.finditer(content):
                line = content.count('\n', 0, match.start()) + 1
                print(f'{path.relative_to(root)}:{line}: potential secret ({rule})')
                findings += 1
    print(f'Secret scan: {findings} findings')
    return 1 if findings else 0


if __name__ == '__main__':
    raise SystemExit(scan(Path(__file__).resolve().parents[1]))
