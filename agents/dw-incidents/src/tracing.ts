/**
 * Lightweight tracing for incident lifecycle.
 * Uses @data-workers/enterprise OTelIntegration if available,
 * falls back to no-op spans.
 */

import { OTelIntegration } from '@data-workers/enterprise';
import type { Span as OTelSpan } from '@data-workers/enterprise';

export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: 'ok' | 'error', message?: string): void;
  end(): void;
}

/** Adapter that wraps the enterprise OTelIntegration Span */
class OTelSpanAdapter implements Span {
  constructor(
    private readonly otel: OTelIntegration,
    private readonly inner: OTelSpan,
  ) {}

  setAttribute(key: string, value: string | number | boolean): void {
    this.inner.attributes[key] = String(value);
  }

  setStatus(status: 'ok' | 'error', _message?: string): void {
    this.inner.status = status;
    if (_message) {
      this.inner.attributes['status.message'] = _message;
    }
  }

  end(): void {
    this.otel.endSpan(this.inner, this.inner.status === 'error' ? 'error' : 'ok');
  }
}

const otel = new OTelIntegration({ serviceName: 'dw-incidents' });

export function startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
  const stringAttrs: Record<string, string> = {};
  if (attributes) {
    for (const [k, v] of Object.entries(attributes)) {
      stringAttrs[k] = String(v);
    }
  }
  const inner = otel.startSpan(name, stringAttrs);
  return new OTelSpanAdapter(otel, inner);
}
