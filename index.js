'use strict';

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
  // const reg = /^((8|7|\+7)[\- ]?)?(\(?\d{3}\)?[\- ]?)?[\d\- ]{7,10}$/; // for all phones
  const reg = /^((8|7|\+7)[\- ]?)(\(?\d{3}\)?[\- ]?)[\d\- ]{7,10}$/; // mobile phones
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
          Object.assign({}, object)) !== false;
}

function isKeysExist(object, keys) {
  return keys.every(key => isKeyExist(object, key));
}

function getValueFromKey(object, key, def = null) {
  return key.split('.').reduce((a, c) => c in a ? a[c] : def, {...object});
}

function setValueFromKey(object, key, value) {
  key.split('.').reduce((a, c, i, arr) => arr.length !== (i + 1) ? (c in a ? a[c] : a[c] = {}) : a[c] = value, object);
}

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
  InvalidStructureValue: 'InvalidStructureValue',
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
    if (!isInteger(value) && (!isString(value) || !/^\d+$/.test(value))) {
      logger(SanitizerError.InvalidValue);
      value = 0;
    }
    return parseInt(value, 10);
  }
}

class FloatRule extends ISanitizerRule {
  sanitize(value, logger = this.logger) {
    if (!isFloat(value) && (!isString(value) || !/^\d+\.\d+$/.test(value))) {
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
    return value.replace(/^8/, '7').replace(/\D+/g, '');
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

/** @typedef {Object} SanitizerSpec */
class Sanitizer {
  /**
   * @param {Object} rules
   * @param {IStructuralRule|ISanitizerRule} rules.*
   */
  constructor(rules) {
    this.rules = rules;
    this.errors = {};
  }

  /**
   * @param {SanitizerSpec} spec
   * @param {Object} payload
   * @throws {SanitizeError}
   */
  sanitizeBySpec(spec, payload) {
    const sanitizedPayload = {};
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
      if (isKeyExist(payload, specKey)) {
        const ruleName = getValueFromKey(spec, specKey);
        if (ruleName in this.rules) {
          const rawValue = flatPayload[specKey];
          const sanitizer = this.rules[ruleName];
          setValueFromKey(sanitizedPayload, specKey, sanitizer.sanitize(rawValue, error => this.errors[specKey] = error));
        } else {
          this.errors[specKey] = SanitizerError.InvalidSpecRule;
        }
      } else {
        this.errors[specKey] = SanitizerError.KeyDoesNotExist;
      }
    }
    return sanitizedPayload;
  }

  toFlatObject(object) {
    function flat(res, key, val, pre = '') {
      const prefix = [pre, key].filter(v => v).join('.');
      return typeof val === 'object' && !isArray(val)
          ? Object.keys(val).
              reduce((prev, curr) => flat(prev, curr, val[curr], prefix), res)
          : Object.assign(res, {[prefix]: val});
    }

    return Object.keys(object).
        reduce((prev, curr) => flat(prev, curr, object[curr]), {});
  }
}

const StandardSanitizer = new Sanitizer({
  'int': new IntegerRule(),
  'float': new FloatRule(),
  'phone': new PhoneRule(),
  'string': new StringRule(),
  'int[]': new TypedArrayRule(new IntegerRule()),
  'float[]': new TypedArrayRule(new FloatRule()),
  'phone[]': new TypedArrayRule(new PhoneRule()),
  'string[]': new TypedArrayRule(new StringRule()),
});

export {
  IntegerRule,
  FloatRule,
  StringRule,
  PhoneRule,
  TypedArrayRule,
  SanitizerError,
  StandardSanitizer,
};
