import { describe, it, expect } from 'vitest';
import {
  parseRequest,
  buildResponse,
  buildErrorResponse,
  buildNotification,
  isNotification,
  JsonRpcParseError,
  JSON_RPC_ERRORS,
} from '../transport.js';

describe('JSON-RPC 2.0 Transport', () => {
  describe('parseRequest', () => {
    it('parses valid request', () => {
      const req = parseRequest(JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tools/list',
      }));
      expect(req.method).toBe('tools/list');
      expect(req.id).toBe(1);
    });

    it('parses request with params', () => {
      const req = parseRequest(JSON.stringify({
        jsonrpc: '2.0', id: 'abc', method: 'tools/call',
        params: { name: 'echo', arguments: { msg: 'hi' } },
      }));
      expect(req.params).toBeDefined();
    });

    it('throws on invalid JSON', () => {
      expect(() => parseRequest('not json')).toThrow(JsonRpcParseError);
    });

    it('throws on missing jsonrpc version', () => {
      expect(() => parseRequest(JSON.stringify({ id: 1, method: 'test' }))).toThrow();
    });

    it('throws on missing method', () => {
      expect(() => parseRequest(JSON.stringify({ jsonrpc: '2.0', id: 1 }))).toThrow();
    });
  });

  describe('buildResponse', () => {
    it('builds success response', () => {
      const res = buildResponse(1, { tools: [] });
      expect(res.jsonrpc).toBe('2.0');
      expect(res.id).toBe(1);
      expect(res.result).toEqual({ tools: [] });
      expect(res.error).toBeUndefined();
    });
  });

  describe('buildErrorResponse', () => {
    it('builds error response', () => {
      const res = buildErrorResponse(1, JSON_RPC_ERRORS.METHOD_NOT_FOUND, 'Not found');
      expect(res.error?.code).toBe(-32601);
      expect(res.error?.message).toBe('Not found');
    });
  });

  describe('buildNotification', () => {
    it('builds notification without id', () => {
      const notif = buildNotification('notifications/initialized');
      expect(notif.jsonrpc).toBe('2.0');
      expect(notif.method).toBe('notifications/initialized');
      expect('id' in notif).toBe(false);
    });
  });

  describe('isNotification', () => {
    it('identifies notifications', () => {
      const notif = { jsonrpc: '2.0' as const, method: 'test' };
      expect(isNotification(notif)).toBe(true);
    });

    it('identifies requests', () => {
      const req = { jsonrpc: '2.0' as const, id: 1, method: 'test' };
      expect(isNotification(req)).toBe(false);
    });
  });
});
