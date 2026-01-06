"""NCE Frappe App - WordPress to Frappe Sync"""

__version__ = "1.0.71"
MAJOR_VERSION = 1


def get_branch():
    """Detect current git branch dynamically at runtime."""
    import subprocess
    import os
    try:
        app_dir = os.path.dirname(os.path.abspath(__file__))
        branch = subprocess.check_output(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
            cwd=app_dir,
            stderr=subprocess.DEVNULL
        ).decode().strip()
        return branch
    except Exception:
        return "unknown"

