import {describe, expect, it} from '@jest/globals'
import { utils } from '../shared/utils.mjs';

const getObjectDifference = utils.getObjectDifference;

const tests = [
  {
    name: "BasicDifference",
    testFn: () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };
      const output = getObjectDifference(obj1, obj2);
      expect(output).toEqual({ b: 3 });
    },
  },
  {
    name: "NestedDifference",
    testFn: () => {
      const obj1 = { a: { x: 1 }, b: 2 };
      const obj2 = { a: { x: 2 }, b: 2 };
      const output = getObjectDifference(obj1, obj2);
      expect(output).toEqual({ a: { x: 2 } });
    },
  },
  {
    name: "ArrayDifference",
    testFn: () => {
      const obj1 = { a: [1, 2, 3] };
      const obj2 = { a: [1, 2, 4] };
      const output = getObjectDifference(obj1, obj2);
      expect(output).toEqual({ a: [null, null, 4] });
    },
  },
  {
    name: "MixedDifference",
    testFn: () => {
      const obj1 = { a: [1, { x: 1 }], b: 2 };
      const obj2 = { a: [2, { x: 1 }], b: 3 };
      const output = getObjectDifference(obj1, obj2);
      expect(output).toEqual({ a: [2, null], b: 3 });
    },
  },
  {
    name: "NoDifference",
    testFn: () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };
      const output = getObjectDifference(obj1, obj2);
      expect(output).toBeUndefined();
    },
  },
  {
    name: "NullValue",
    testFn: () => {
      const obj1 = { a: 1 };
      const obj2 = { a: null };
      const output = getObjectDifference(obj1, obj2);
      expect(output).toEqual({ a: null });
    },
  },
  {
    name: "nested with empty in obj1",
    testFn: () => {
      const obj1 = { a: { b: { c : 1, d: {} } } };
      const obj2 = { a: { b: { c : 1, d: 2 } } };
      const output = getObjectDifference(obj1, obj2);
      expect(output).toEqual({ a: { b: { d: 2 } } });
    },
  },
  {
    name: "nested with empty in obj2",
    testFn: () => {
      const obj1 = { a: { b: { c : 1, d: 2 } } };
      const obj2 = { a: { b: { c : 1, d: {} } } };
      const output = getObjectDifference(obj1, obj2);
      expect(output).toEqual({ a: { b: { d: {} } } });
    },
  }
];

describe('getObjectDifference', () => {
  tests.forEach(({ name, testFn }) => {
    it(name, testFn);
  });
});
