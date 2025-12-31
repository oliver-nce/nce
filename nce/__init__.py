"""NCE Frappe App - WordPress to Frappe Sync"""

import os
import subprocess
from datetime import datetime

MAJOR_VERSION = 1

def get_version_info():
    """Get version info from git commit count and date."""
    try:
        # Get directory of this file to find git repo
        app_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Get commit count
        count = subprocess.check_output(
            ['git', 'rev-list', '--count', 'HEAD'],
            cwd=app_dir,
            stderr=subprocess.DEVNULL
        ).decode().strip()
        
        # Get last commit date
        date = subprocess.check_output(
            ['git', 'log', '-1', '--format=%ci'],
            cwd=app_dir,
            stderr=subprocess.DEVNULL
        ).decode().strip()[:16]  # "2025-12-30 15:30"
        
        return {
            "version": f"{MAJOR_VERSION}.{count}",
            "timestamp": date,
            "display": f"v{MAJOR_VERSION}.{count} ({date})"
        }
    except Exception:
        return {
            "version": f"{MAJOR_VERSION}.0",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "display": f"v{MAJOR_VERSION}.0"
        }

_version_info = get_version_info()
__version__ = _version_info["version"]

