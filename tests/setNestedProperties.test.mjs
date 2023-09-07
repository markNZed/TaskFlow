import {describe, expect, it} from '@jest/globals'
import { utils } from '../processor/react/src/utils/utils.mjs';

const setNestedProperties = utils.setNestedProperties;

const tests = [
  {
    name: "singleArgument",
    testFn: () => {
      const input = { "a.b": 1, "a.c": 2 };
      const output = setNestedProperties(input);
      expect(output).toEqual({ a: {b: 1, c: 2 }});
    },
  },
  {
    name: "singleArgumentUpdate",
    testFn: () => {
      const input = { "input.selectedTaskId": "test" };
      const output = setNestedProperties(input);
      expect(output).toEqual({ input: { selectedTaskId: "test"}});
    },
  },
  {
    name: "BasicPropertyAddition",
    testFn: () => {
      const input = { a: 1 };
      const output = setNestedProperties(input, 'b', 2);
      expect(output).toEqual({ a: 1, b: 2 });
    },
  },
  {
    name: "NestedPropertyAddition",
    testFn: () => {
      const input = { a: { b: 1 } };
      const output = setNestedProperties(input, 'a.c', 2);
      expect(output).toEqual({ a: { b: 1, c: 2 } });
    },
  },
  {
    name: "ReplaceExistingProperty",
    testFn: () => {
      const input = { a: 1 };
      const output = setNestedProperties(input, 'a', 2);
      expect(output).toEqual({ a: 2 });
    },
  },
  {
    name: "InputArrayValidation",
    testFn: () => {
      expect(() => {
        setNestedProperties([], 'a', 1);
      }).toThrowError(/Input must be a non-null object\./);
    },
  },
  {
    name: "InputNullValidation",
    testFn: () => {
      expect(() => {
        setNestedProperties(null, 'a', 1);
      }).toThrowError(/Input must be a non-null object\./);
    },
  },
  {
    name: "InvalidEmptyKey",
    testFn: () => {
      expect(() => {
        setNestedProperties({}, '', 1);
      }).toThrowError(/Invalid empty key provided\./);
    },
  },
  {
    name: "InvalidDottedKey",
    testFn: () => {
      expect(() => {
        setNestedProperties({}, '.', 1);
      }).toThrowError(/Invalid key provided:/);
    },
  },
  {
    name: "DeepNestedPropertyAddition",
    testFn: () => {
      const input = { a: { b: { c: 1 } } };
      const output = setNestedProperties(input, 'a.b.d', 2);
      expect(output).toEqual({ a: { b: { c: 1, d: 2 } } });
    },
  },
  {
    name: "NestedObjectReplacement",
    testFn: () => {
      const input = { a: { b: 1 } };
      const output = setNestedProperties(input, 'a', { c: 2 });
      expect(output).toEqual({ a: { c: 2 } });
    },
  },
  {
    name: "DeeplyNestedPropertyWithExistingFlat",
    testFn: () => {
      const input = { 'a.b': 1 };
      const output = setNestedProperties(input, 'a.b.c', 2);
      expect(output).toEqual({ 'a.b': 1, a: { b: { c: 2 } } });
    },
  },
  {
    name: "InplaceModification",
    testFn: () => {
      const input = { a: 1 };
      const output = setNestedProperties(input, 'b', 2);
      expect(output).toStrictEqual({ a: 1, b: 2 });
    },
  },
  {
    name: "EmptyObject",
    testFn: () => {
      const input = {};
      const output = setNestedProperties(input, 'a', 1);
      expect(output).toEqual({ a: 1 });
    },
  },
  {
    name: "ArrayInObject",
    testFn: () => {
      const input = { a: [1, 2] };
      const output = setNestedProperties(input, 'a.2', 3);
      expect(output).toEqual({ a: [1, 2, 3] });
    },
  },
  {
    name: "NestedObjectInArray",
    testFn: () => {
      const input = { a: [{ b: 1 }] };
      const output = setNestedProperties(input, 'a.0.c', 2);
      expect(output).toEqual({ a: [{ b: 1, c: 2 }] });
    },
  },
  {
    name: "MultipleNestedKeys",
    testFn: () => {
      const input = {};
      const output = setNestedProperties(input, 'a.b.c.d.e', 1);
      expect(output).toEqual({ a: { b: { c: { d: { e: 1 } } } } });
    },
  },
  {
    name: "ExistingMultipleNestedKeys",
    testFn: () => {
      const input = { a: { b: { c: 1 } } };
      const output = setNestedProperties(input, 'a.b.d', 2);
      expect(output).toEqual({ a: { b: { c: 1, d: 2 } } });
    },
  },
  {
    name: "NonStringKeys",
    testFn: () => {
      const input = { 1: { 2: 3 } };
      const output = setNestedProperties(input, '1.2', 4);
      expect(output).toEqual({ 1: { 2: 4 } });
    },
  },
  {
    name: "BooleanKey",
    testFn: () => {
      const input = { true: 1 };
      const output = setNestedProperties(input, 'true', 2);
      expect(output).toEqual({ true: 2 });
    },
  },
  {
    name: "NullValue",
    testFn: () => {
      const input = { a: 1 };
      const output = setNestedProperties(input, 'b', null);
      expect(output).toEqual({ a: 1, b: null });
    },
  },
  {
    name: "UndefinedValue",
    testFn: () => {
      const input = { a: 1 };
      const output = setNestedProperties(input, 'b', undefined);
      expect(output).toEqual({ a: 1, b: undefined });
    },
  },
  {
    name: "OverwriteExistingNonObject",
    testFn: () => {
      const input = { a: 1 };
      expect(() => {
        setNestedProperties(input, 'a.b', 2);
      }).toThrowError(/Cannot set a nested property on a non-object value/);
    },
  },
];

describe('setNestedProperties', () => {
  tests.forEach(({ name, testFn }) => {
    it(name, testFn);
  });
});
