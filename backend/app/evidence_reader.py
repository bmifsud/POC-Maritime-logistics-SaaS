"""The only utility allowed to resolve and read evidence log paths."""
from pathlib import Path


class UnsafeEvidence(ValueError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class EvidenceReader:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.directory = self.root / '.adlc/evidence'

    def resolve(self, relative: str) -> Path:
        path = Path(relative)
        if '..' in relative or path.is_absolute() or '\\' in relative or path.suffix != '.log':
            raise UnsafeEvidence('Invalid evidence log path')
        base = self.directory.resolve()
        if not base.is_relative_to(self.root):
            raise UnsafeEvidence('Evidence directory escapes repository', 403)
        target = (self.root / path).resolve()
        if not target.is_relative_to(base) or target == base:
            raise UnsafeEvidence('Evidence log escapes evidence directory', 403)
        return target

    def read(self, relative: str) -> str:
        target = self.resolve(relative)
        if not target.is_file():
            raise FileNotFoundError('Evidence log missing')
        content = target.read_text(encoding='utf-8')
        if not content.strip():
            raise FileNotFoundError('Evidence log empty')
        return content
