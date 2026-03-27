# Data Workers Python SDK

A lightweight Python client for interacting with a [Data Workers](https://github.com/DhanushAShetty/dw-claw-community) server.

## Installation

```bash
pip install data-workers
```

## Quick Start

```python
from data_workers import DataWorkersClient

client = DataWorkersClient(base_url="http://localhost:3000")

# List available tools
tools = client.list_tools()

# Call a tool
result = client.call_tool("catalog.list_tables", params={"database": "analytics"})
print(result)

# List agents
agents = client.list_agents()
```

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `base_url` | `http://localhost:3000` | Data Workers server URL |
| `api_key` | `None` | Optional API key for authenticated endpoints |
| `timeout` | `30.0` | Request timeout in seconds |

## License

MIT
