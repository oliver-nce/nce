from setuptools import setup, find_packages

with open("requirements.txt") as f:
    install_requires = f.read().strip().split("\n")

# Get version from __version__ variable in nce/__init__.py
from nce import __version__ as version

setup(
    name="nce",
    version=version,
    description="NCE WordPress to Frappe Sync App",
    author="NCE",
    author_email="dev@ncesoccer.com",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=install_requires,
)

