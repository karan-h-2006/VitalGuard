"""Crash-safe local persistence for readings that could not be published."""

from .local_buffer import LocalBuffer

__all__ = ["LocalBuffer"]
