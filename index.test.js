import {
  isArray,
  isFloat,
  isInteger,
  isKeysExist,
  isPhone,
  isString,
  isTypedArray,
  StringRule,
  TypedArrayRule,
} from './index';

describe('Type check atoms', () => {
  test('must be float', () => {
    expect(isFloat(123.23)).toBe(true);
    expect(isFloat('1223')).toBe(false);
    expect(isFloat(123)).toBe(false);
  });

  test('must be int', () => {
    expect(isInteger(123)).toBe(true);
    expect(isInteger(123.23)).toBe(false);
    expect(isInteger('1223')).toBe(false);
  });

  test('must be string', () => {
    expect(isString('12312sad')).toBe(true);
    expect(isString(123.23)).toBe(false);
    expect(isString(123)).toBe(false);
  });

  test('must be phone number', () => {
    expect(isPhone('8 (800) 555-35-35')).toBe(true);
    expect(isPhone('7 (800) 555-35-35')).toBe(true);
    expect(isPhone('+7 (800) 555-35-35')).toBe(true);
  });

  test('must be array', () => {
    expect(isArray([1, 2, 3])).toBe(true);
    expect(isArray('123')).toBe(false);
    expect(isArray(null)).toBe(false);
  });

  test('must be typed array', () => {
    expect(isTypedArray([1, 2, 3], isInteger)).toBe(true);
    expect(isTypedArray(['123', 1, null], isInteger)).toBe(false);
  });

  test('keys are exist in object', () => {
    const testDeepObject = {
      foo: true,
      bar: {
        baz: {
          qux: () => {},
        },
      },
    };
    expect(isKeysExist(testDeepObject, ['foo', 'bar', 'bar.baz.qux'])).
        toBe(true);
    expect(isKeysExist(testDeepObject, ['foo', 'bar.qux', 'baz.bar'])).
        toBe(false);
  });
});

describe('Sanitizers', () => {
  test('Typed array sanitizer', () => {
    expect(new TypedArrayRule(new StringRule()).sanitize(['foo', 'bar'])).
        toStrictEqual(['foo', 'bar']);
    expect(new TypedArrayRule(new StringRule()).sanitize(['foo', 'bar', null])).
        toStrictEqual([]);
  });
});

