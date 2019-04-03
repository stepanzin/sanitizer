/**
 Предположим, что перед нами стоит задача обработать ответ от сервера,
 содержащий данные в формате JSON. Нужно написать санитайзер,
 который провалидирует и преобразует переданные данные в требуемый формат.

 Требования:
 * Язык JavaScript без сторонних фреймворков и библиотек (кроме библиотек для тестирования)
 * Поддержка строк, целых чисел, чисел с плавающей точкой и российских федеральных номеров телефонов
 * Поддержка массивов произвольной длины с элементами одного определённого типа
 * Поддержка структур — ассоциативных массивов произвольной вложенности с заранее известными ключами
 * Генерация списка ошибок для некорректных значений
 * Возможность расширения путём добавления новых типов параметров
 * Тесты

 Примеры:
 1) из объекта '{"foo": "123", "bar": "asd", "baz": "8 (950) 288-56-23"}'
 при указанных программистом типах "целое число", "строка" и "номер телефона"
 соответственно должен получиться объект с тремя полями:
 - целочисленным foo = 123,
 - строковым bar = "asd"
 - строковым "baz" = "79502885623".
 2) при указании для строки "123абв" типа "целое число" должна быть сгенерирована ошибка
 3) при указании для строки "260557" типа "номер телефона" должна быть сгенерирована ошибка
 */

function isString(value) {
  return typeof value === 'string';
}

function isInteger(value) {
  return Number(value) === value && value % 1 === 0;
}

function isFloat(value) {
  return Number(value) === value && value % 1 !== 0;
}

function isPhone(value) {
  const reg = /^((8|7|\+7)[\- ]?)?(\(?\d{3}\)?[\- ]?)?[\d\- ]{7,10}$/;
  return reg.test(value);
}

function isArray(value) {
  return Array.isArray(value);
}

function isTypedArray(value, predicate) {
  return isArray(value) && value.every(item => predicate(item));
}

function isKeyExist(object, key) {
  return key.split('.').
      reduce((a, c) => c in a ? a[c] || 1 : false,
          Object.assign({...object}, object)) !== false;
}

function isKeysExist(object, keys) {
  return keys.every(key => isKeyExist(object, key));
}

function getValueFromKey(object, key, def = null) {
  return key.split('.').reduce((a, c) => c in a ? a[c] : def, {...object})
}

// todo add object deep set

export {
  isString,
  isInteger,
  isFloat,
  isPhone,
  isArray,
  isTypedArray,
  isKeyExist,
  isKeysExist,
};

/** @enum {string} */
const SanitizerError = {
  InvalidPayload: 'InvalidPayload',
  InvalidSpecRule: 'InvalidSpecRule',
  InvalidValue: 'InvalidValue',
  KeyDoesNotExist: 'KeyDoesNotExist',
  ExtraField: 'ExtraField',
};

class ISanitizerRule {
  /**
   * @param {*} value
   * @param {Function} [logger]
   */
  sanitize(value, logger = this.logger) {}

  /**
   * @param {SanitizerError} error
   */
  logger(error) {}
}

class IntegerRule extends ISanitizerRule {
  sanitize(value, logger = this.logger) {
    if (!isInteger(value) || !isFloat(value) ||
        (isString(value) && !/^\d.$/.test(value))) {
      logger(SanitizerError.InvalidValue);
      value = 0;
    }
    return parseInt(value, 10);
  }
}

class FloatRule extends ISanitizerRule {
  sanitize(value, logger = this.logger) {
    if (!isInteger(value) || !isFloat(value) ||
        (isString(value) && !/^\d.\.\d.$/.test(value))) {
      logger(SanitizerError.InvalidValue);
      value = 0.0;
    }
    return parseFloat(value);
  }
}

class StringRule extends ISanitizerRule {
  sanitize(value, logger = this.logger) {
    if (!isString(value)) {
      logger(SanitizerError.InvalidValue);
      value = '';
    }
    return value;
  }
}

class PhoneRule extends ISanitizerRule {
  sanitize(value, logger = this.logger) {
    if (!isPhone(value)) {
      logger(SanitizerError.InvalidValue);
      value = '';
    }
    return value.replace(/\D./, '');
  }
}

class IStructuralRule extends ISanitizerRule {
  /** @param {ISanitizerRule} rule */
  constructor(rule) {
    super();
    if (!(rule instanceof ISanitizerRule)) throw new TypeError(
        'Invalid rule instance');
    this.rule = rule;
  }

  // noinspection JSCheckFunctionSignatures
  /**
   * @param {SanitizerError} error
   * @param {Array} indexes
   */
  logger(error, indexes) {}
}

class TypedArrayRule extends IStructuralRule {
  sanitize(array, logger = this.logger) {
    if (isArray(array)) {
      const invalidIndexes = [];
      array = array.map((item, index) => this.rule.sanitize(item,
          error => { if (error) invalidIndexes.push(index); }));
      if (invalidIndexes.length) {
        logger(SanitizerError.InvalidStructureValue, invalidIndexes);
        array = [];
      }
    } else {
      logger(SanitizerError.InvalidValue, []);
      array = [];
    }
    return array;
  }
}

class SanitizeError extends Error {}

/** @typedef {Object} SanitizerSpec */
class Sanitizer {
  /**
   * @param {Object} rules
   * @param {IStructuralRule|ISanitizerRule} rules.*
   */
  constructor(rules) {
    this.rules = {};
    const errors = {};
    this.errors = new Proxy(errors, {
      get(target, p) {
        return target[p];
      },
      set(target, p, value) {
        if (!target[p]) {
          target[p] = [value];
        } else {
          target[p].push(value);
        }
      },
    });

  }

  /**
   * @param {SanitizerSpec} spec
   * @param {Object} payload
   * @throws {SanitizeError}
   */
  sanitizeBySpec(spec, payload) {
    const sanitizedPayload = {}
    const flatSpec = this.toFlatObject(spec);
    const flatPayload = this.toFlatObject(payload);
    const specKeys = Object.keys(flatSpec);
    const payloadKeys = Object.keys(flatPayload);
    if (specKeys.length !== payloadKeys.length) {
      for (const payloadKey of payloadKeys) {
        if (!specKeys.includes(payloadKey))
          this.errors[payloadKey] = SanitizerError.ExtraField;
      }
    }
    for (const specKey in flatSpec) {
      if (!isKeyExist(payload, specKey)) {
        this.errors[specKey] = SanitizerError.InvalidValue;
      } else {
        const rule = getValueFromKey(spec, specKey)
        if (!this.rules.includes(rule)) {
          this.errors[specKey] = SanitizerError.InvalidSpecRule;
        } else {
          // todo add object deep set
        }
      }
    }
    return sanitizedPayload
  }

  toFlatObject(object) {
    function flat(res, key, val, pre = '') {
      const prefix = [pre, key].filter(v => v).join('.');
      return typeof val === 'object'
          ? Object.keys(val).
              reduce((prev, curr) => flat(prev, curr, val[curr], prefix), res)
          : Object.assign(res, {[prefix]: val});
    }

    return Object.keys(object).
        reduce((prev, curr) => flat(prev, curr, input[curr]), {});
  }
}

const StandardSanitizer = new Sanitizer({
  'int': new IntegerRule(),
  'float': new FloatRule(),
  'phone': new PhoneRule(),
  'string': new StringRule(),
});

export {
  IntegerRule,
  FloatRule,
  StringRule,
  PhoneRule,
  TypedArrayRule,
  StandardSanitizer,
};
