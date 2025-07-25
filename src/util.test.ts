import { handlePath } from './util';

/**
 * Unit tests for the handlePath function
 * 
 * This function is designed to remove a specified path prefix from URL paths.
 * It handles both absolute paths (starting with /) and relative paths.
 * 
 * Test Coverage:
 * - ✅ Basic path prefix removal
 * - ✅ Different path prefix values
 * - ✅ Edge cases (empty prefix, root path, exact matches)
 * - ✅ Special characters in path prefix
 * - ✅ Case sensitivity
 * - ✅ Nested paths with multiple segments
 */
describe('handlePath', () => {
    test('should remove leading slash and pathPrefix when path starts with /{pathPrefix}/', () => {
        const url = new URL('https://example.com/openai/v1/chat/completions');
        const result = handlePath(url, 'openai');
        expect(result).toBe('v1/chat/completions');
    });

    test('should remove pathPrefix when path starts with {pathPrefix}/', () => {
        const url = new URL('https://example.com/openai/models');
        const result = handlePath(url, 'openai');
        expect(result).toBe('models');
    });

    test('should handle different pathPrefix values', () => {
        const url = new URL('https://example.com/api/v1/test');
        const result = handlePath(url, 'api');
        expect(result).toBe('v1/test');
    });

    test('should return original path when pathPrefix not found at start', () => {
        const url = new URL('https://example.com/v1/openai/chat');
        const result = handlePath(url, 'openai');
        expect(result).toBe('/v1/openai/chat');
    });

    test('should handle root path', () => {
        const url = new URL('https://example.com/');
        const result = handlePath(url, 'openai');
        expect(result).toBe('/');
    });

    test('should handle empty pathPrefix', () => {
        const url = new URL('https://example.com/api/test');
        const result = handlePath(url, '');
        expect(result).toBe('/api/test');
    });

    test('should handle path that exactly matches pathPrefix', () => {
        const url = new URL('https://example.com/openai');
        const result = handlePath(url, 'openai');
        expect(result).toBe('/openai');
    });

    test('should handle path with only leading slash and pathPrefix', () => {
        const url = new URL('https://example.com/openai/');
        const result = handlePath(url, 'openai');
        expect(result).toBe('');
    });

    test('should handle nested paths with multiple segments', () => {
        const url = new URL('https://example.com/openai/v1/chat/completions/stream');
        const result = handlePath(url, 'openai');
        expect(result).toBe('v1/chat/completions/stream');
    });

    test('should handle pathPrefix that appears later in path', () => {
        const url = new URL('https://example.com/api/openai/test');
        const result = handlePath(url, 'openai');
        expect(result).toBe('/api/openai/test');
    });

    test('should handle special characters in pathPrefix', () => {
        const url = new URL('https://example.com/my-api/test');
        const result = handlePath(url, 'my-api');
        expect(result).toBe('test');
    });

    test('should be case sensitive', () => {
        const url = new URL('https://example.com/OpenAI/test');
        const result = handlePath(url, 'openai');
        expect(result).toBe('/OpenAI/test');
    });
});
