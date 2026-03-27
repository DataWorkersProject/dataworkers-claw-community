"""Minimal HTTP client for a Data Workers server."""

from __future__ import annotations

from typing import Any

import httpx

from data_workers.types import Agent, AgentStatus, Tool, ToolResult


class DataWorkersClient:
    """Synchronous client for the Data Workers API.

    Parameters
    ----------
    base_url:
        Root URL of the Data Workers server (default ``http://localhost:3000``).
    api_key:
        Optional bearer token for authenticated endpoints.
    timeout:
        HTTP request timeout in seconds (default ``30.0``).
    """

    def __init__(
        self,
        base_url: str = "http://localhost:3000",
        api_key: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        self._client = httpx.Client(
            base_url=base_url,
            headers=headers,
            timeout=timeout,
        )

    # -- Tools ----------------------------------------------------------------

    def list_tools(self) -> list[Tool]:
        """Return all MCP tools the server exposes."""
        resp = self._client.get("/api/tools")
        resp.raise_for_status()
        return [
            Tool(
                name=t["name"],
                description=t.get("description", ""),
                parameters=t.get("parameters", {}),
            )
            for t in resp.json()
        ]

    def call_tool(self, name: str, params: dict[str, Any] | None = None) -> ToolResult:
        """Invoke a tool by name and return the result."""
        resp = self._client.post(
            "/api/tools/call",
            json={"tool": name, "parameters": params or {}},
        )
        resp.raise_for_status()
        body = resp.json()
        return ToolResult(
            tool=name,
            success=body.get("success", True),
            data=body.get("data"),
            error=body.get("error"),
        )

    # -- Agents ---------------------------------------------------------------

    def list_agents(self) -> list[Agent]:
        """Return all registered agents and their current status."""
        resp = self._client.get("/api/agents")
        resp.raise_for_status()
        return [
            Agent(
                name=a["name"],
                status=AgentStatus(a.get("status", "idle")),
                tools=a.get("tools", []),
                description=a.get("description", ""),
            )
            for a in resp.json()
        ]

    def get_agent(self, name: str) -> Agent:
        """Fetch a single agent by name."""
        resp = self._client.get(f"/api/agents/{name}")
        resp.raise_for_status()
        a = resp.json()
        return Agent(
            name=a["name"],
            status=AgentStatus(a.get("status", "idle")),
            tools=a.get("tools", []),
            description=a.get("description", ""),
        )

    # -- Lifecycle ------------------------------------------------------------

    def close(self) -> None:
        """Close the underlying HTTP connection pool."""
        self._client.close()

    def __enter__(self) -> DataWorkersClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
