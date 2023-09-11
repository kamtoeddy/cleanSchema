import { StringKey } from '../schema/types'
import { ObjectType } from './types'

export {
  getKeysAsProps,
  getUnique,
  getUniqueBy,
  isEqual,
  isFunction,
  isKeyOf,
  isNullOrUndefined,
  isObject,
  isOneOf,
  toArray,
  sort,
  sortKeys
}

function getKeysAsProps<T>(object: T) {
  return Object.keys(object as object) as StringKey<T>[]
}

/**
 * tell whether `a` & `b` are equals
 * @param {any} a
 * @param {any} b
 * @param {number|undefined} depth how deep in nesting should equality checks be performed for objects
 * @returns {boolean}
 */

function isEqual(a: any, b: any, depth: number = 1): boolean {
  const typeOfA = typeof a

  if (typeOfA != typeof b) return false

  if (typeOfA == 'undefined') return true

  if (['bigint', 'boolean', 'number', 'string', 'symbol'].includes(typeOfA))
    return a == b

  if (isNullOrUndefined(a) || isNullOrUndefined(b)) return a == b

  let keysOfA = Object.keys(a),
    keysOfB = Object.keys(b)

  if (keysOfA.length != keysOfB.length) return false
  ;(keysOfA = sort(keysOfA)), (keysOfB = sort(keysOfB))

  if (JSON.stringify(keysOfA) != JSON.stringify(keysOfB)) return false

  if (depth > 0 && keysOfA.length)
    return keysOfA.every((key) => isEqual(a[key], b[key], depth - 1))

  return JSON.stringify(sortKeys(a)) == JSON.stringify(sortKeys(b))
}

function isFunction(value: any): value is Function {
  return typeof value === 'function'
}

function isKeyOf<T>(
  prop: string | number | symbol,
  object: T
): prop is keyof T {
  return Object.hasOwnProperty.call(object, prop)
}

function isNullOrUndefined(value: any): value is null | undefined {
  return isOneOf(value, [null, undefined])
}

function isObject(value: any): value is ObjectType {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function isOneOf<T>(value: any, values: T[]): value is T {
  return values.includes(value)
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

function sort<T>(data: T[]): T[] {
  return data.sort((a, b) => (a < b ? -1 : 1))
}

function sortKeys<T extends ObjectType>(object: T): T {
  const keys = sort(Object.keys(object))

  return keys.reduce((prev, next: keyof T) => {
    prev[next] = object[next]

    return prev
  }, {} as T)
}

function getUnique<T>(list: T[]) {
  let _list = list.map((dt) => _serialize(dt))

  _list = Array.from(new Set(_list))

  return _list.map((dt) => _serialize(dt, true))
}

function getUniqueBy<T>(list: T[], key?: string) {
  if (!key) return getUnique(list)

  const obj: ObjectType = {}

  list.forEach((dt) => (obj[_getDeepValue(dt as ObjectType, key)] = dt))

  return Object.values(obj) as T[]
}

function _getDeepValue(data: ObjectType, key: string): any {
  return key.split('.').reduce((prev, next) => prev?.[next], data)
}

function _serialize(dt: any, revert = false) {
  try {
    return revert ? JSON.parse(dt) : JSON.stringify(dt)
  } catch (err) {
    return dt
  }
}