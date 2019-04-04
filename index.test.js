import {
  isArray,
  isFloat,
  isInteger,
  isKeysExist,
  isPhone,
  isString,
  isTypedArray,
  FloatRule,
  IntegerRule,
  PhoneRule,
  StringRule,
  TypedArrayRule,
  SanitizerError,
  StandardSanitizer,
} from './index';

describe('Type check atoms', () => {
  test('Must be float', () => {
    expect(isFloat(123.23)).toBe(true);
    expect(isFloat('1223')).toBe(false);
    expect(isFloat(123)).toBe(false);
  });

  test('Must be int', () => {
    expect(isInteger(123)).toBe(true);
    expect(isInteger(123.23)).toBe(false);
    expect(isInteger('1223')).toBe(false);
  });

  test('Must be string', () => {
    expect(isString('12312sad')).toBe(true);
    expect(isString(123.23)).toBe(false);
    expect(isString(123)).toBe(false);
  });

  test('Must be phone number', () => {
    expect(isPhone('8 (800) 555-35-35')).toBe(true);
    expect(isPhone('7 (800) 555-35-35')).toBe(true);
    expect(isPhone('+7 (800) 555-35-35')).toBe(true);
  });

  test('Must be array', () => {
    expect(isArray([1, 2, 3])).toBe(true);
    expect(isArray('123')).toBe(false);
    expect(isArray(null)).toBe(false);
  });

  test('Must be typed array', () => {
    expect(isTypedArray([1, 2, 3], isInteger)).toBe(true);
    expect(isTypedArray(['123', 1, null], isInteger)).toBe(false);
  });

  test('Keys are exist in object', () => {
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
  test('Integer sanitizer', () => {
    expect(new IntegerRule().sanitize(123)).toStrictEqual(123);
    expect(new IntegerRule().sanitize('123')).toStrictEqual(123);
    expect(new IntegerRule().sanitize(null)).toStrictEqual(0);
  });

  test('Float sanitizer', () => {
    expect(new FloatRule().sanitize(123.45)).toStrictEqual(123.45);
    expect(new FloatRule().sanitize('123.45')).toStrictEqual(123.45);
    expect(new FloatRule().sanitize(null)).toStrictEqual(.0);
  });

  test('String sanitizer', () => {
    expect(new StringRule().sanitize('123string')).toStrictEqual('123string');
    expect(new StringRule().sanitize(null)).toStrictEqual('');
  });

  test('Phone sanitizer', () => {
    expect(new PhoneRule().sanitize('+7 (800) 555-35-35')).
        toStrictEqual('78005553535');
    expect(new PhoneRule().sanitize('8 (800) 555-35-35')).
        toStrictEqual('78005553535');
    expect(new PhoneRule().sanitize('555-35-35')).toStrictEqual('');
  });

  test('Typed array sanitizer', () => {
    expect(new TypedArrayRule(new StringRule()).sanitize(['foo', 'bar'])).
        toStrictEqual(['foo', 'bar']);
    expect(new TypedArrayRule(new StringRule()).sanitize(['foo', 'bar', null])).
        toStrictEqual([]);
  });

  test('Standard sanitizer', () => {
    const result = StandardSanitizer.sanitizeBySpec({
      foo: 'int',
      bar: 'float',
      baz: 'phone',
      qux: 'string',
      _nested: {
        foo: 'int[]',
        bar: 'float[]',
        baz: 'phone[]',
        qux: 'string[]',
        _nestedAtoms: {
          foo: 'int',
          bar: 'float',
          baz: 'phone',
          qux: 'string',
        },
      },
    }, {
      foo: '123',
      bar: '123.45',
      baz: '8 (800) 5553535',
      qux: 'string',
      _nested: {
        foo: [123, 345, '678'],
        bar: [123.45, '56.78'],
        baz: ['+7 (914) 700-24-24', '8 (800) 555-35-35'],
        qux: ['foo', 'bar', 'baz'],
        _nestedAtoms: {
          foo: '123',
          bar: '123.45',
          baz: '8 (800) 5553535',
          qux: 'string',
        },
      },
    });
    expect(result).toStrictEqual({
      foo: 123,
      bar: 123.45,
      baz: '78005553535',
      qux: 'string',
      _nested: {
        foo: [123, 345, 678],
        bar: [123.45, 56.78],
        baz: ['79147002424', '78005553535'],
        qux: ['foo', 'bar', 'baz'],
        _nestedAtoms: {
          foo: 123,
          bar: 123.45,
          baz: '78005553535',
          qux: 'string',
        },
      },
    });

    StandardSanitizer.sanitizeBySpec({
      foo: {
        bar: {
          baz: 'int',
        },
      },
    }, {
      foo: {
        bar: {
          baz: '123qux',
        },
      },
    });
    expect(StandardSanitizer.getErrors()).
        toStrictEqual({'foo.bar.baz': SanitizerError.InvalidValue});

    const result2 = StandardSanitizer.sanitizeBySpec({
      foo: {
        bar: {
          baz: 'int',
        },
      },
    }, {
      foo: {
        bar: {
          baz: '123',
          qux: 123,
        },
      },
    });
    expect(result2).toStrictEqual({foo: {bar: {baz: 123}}});
    expect(StandardSanitizer.getErrors()).
        toStrictEqual({'foo.bar.qux': SanitizerError.ExtraField});
  });
});

