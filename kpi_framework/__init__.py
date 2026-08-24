"""Simulator Control Systems KPI framework.

A small, dependency-free toolkit that turns raw session/release/fault records
into the 22-KPI scorecard described in framework/kpi_catalogue.json, and builds
the interactive dashboard that renders it.
"""

__version__ = "1.0.0"

from .catalogue import Catalogue, load_catalogue  # noqa: F401
