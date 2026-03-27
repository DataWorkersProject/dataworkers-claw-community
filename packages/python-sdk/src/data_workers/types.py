"""Type definitions for the Data Workers Python SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class AgentStatus(str, Enum):
    """Runtime status of a Data Workers agent."""

    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"
    STOPPED = "stopped"


@dataclass(frozen=True)
class Tool:
    """Describes a single MCP tool exposed by Data Workers."""

    name: str
    description: str
    parameters: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ToolResult:
    """Result returned from a tool invocation."""

    tool: str
    success: bool
    data: Any = None
    error: str | None = None


@dataclass(frozen=True)
class Agent:
    """Represents a Data Workers agent."""

    name: str
    status: AgentStatus
    tools: list[str] = field(default_factory=list)
    description: str = ""
