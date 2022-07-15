import { ApiError } from "../utils/ApiError";
import { belongsTo } from "../utils/functions";
import { looseObject } from "../utils/interfaces";
import { isEqual } from "../utils/isEqual";
import { fxLooseObject, options, propDefinitionType } from "./interfaces";

export abstract class SchemaCore {
  [key: string]: any;

  protected _propDefinitions: propDefinitionType = {};
  protected _options: options = { timestamp: false };

  protected error = new ApiError({ message: "Validation Error" });

  protected context: looseObject = {};
  protected updated: looseObject = {};

  constructor(
    propDefinitions: propDefinitionType,
    options: options = { timestamp: false }
  ) {
    this._propDefinitions = propDefinitions;
    this._options = options;

    if (!this._hasEnoughProps())
      throw new ApiError({ message: "Invalid properties", statusCode: 500 });
  }

  public get getPropDefinitions() {
    return this._propDefinitions;
  }

  public get getOptions() {
    return this._options;
  }

  protected _canInit = (prop: string): boolean => {
    const propDef = this._propDefinitions[prop];

    if (!propDef) return false;

    const { readonly, required, shouldInit } = propDef;

    if (this._isDependentProp(prop)) return false;

    if (!readonly && !required) return false;

    return belongsTo(shouldInit, [true, undefined]);
  };

  protected _isDependentProp = (prop: string): boolean => {
    const propDef = this._propDefinitions[prop];

    if (!propDef) return false;

    return propDef?.dependent === true;
  };

  protected _getCloneObject = async (toReset: string[] = []) => {
    const defaults = this._getDefaults();
    const props = this._getProps();

    let obj: looseObject = props.reduce((values: looseObject, next) => {
      values[next] = toReset.includes(next)
        ? defaults[next] ?? this[next]
        : this[next] ?? defaults[next];

      return values;
    }, {});

    obj = await this._useSideInitProps(obj);

    return this._useConfigProps(obj);
  };

  protected _getContext = (): looseObject => {
    this._getProps().forEach((prop) => (this.context[prop] = this[prop]));

    return { ...this.context, ...this.updated };
  };

  protected _getCreateActions = () => {
    let _actions: fxLooseObject[] = [];
    const props = this._getProps();

    for (let prop of props) {
      let propActions = this._propDefinitions[prop]?.onCreate ?? [];

      propActions = propActions.filter(
        (action) => typeof action === "function"
      );

      if (propActions?.length) _actions = [..._actions, ...propActions];
    }

    return _actions;
  };

  protected _getCreateObject = async () => {
    const createProps = this._getCreateProps();
    const defaults = this._getDefaults();
    const props = this._getProps();

    let obj: looseObject = {};

    for (let prop of props) {
      const checkLax = this._isLaxProp(prop) && this.hasOwnProperty(prop);
      const isSideInit = this._isSideInit(prop) && this.hasOwnProperty(prop);

      if (createProps.includes(prop) || checkLax || isSideInit) {
        const { reasons, valid, validated } = await this.validate({
          prop,
          value: this[prop],
        });

        if (valid) {
          obj[prop] = validated;

          continue;
        }

        this.error.add(prop, reasons);
      }

      obj[prop] = defaults[prop];
    }

    obj = await this._useSideInitProps(obj);

    return this._useConfigProps(obj);
  };

  protected _getCreateProps = () => {
    const createProps = [];
    const props = this._getProps();

    for (let prop of props) if (this._canInit(prop)) createProps.push(prop);

    return this._sort(createProps);
  };

  protected _getDefaults = () => {
    const defaults: looseObject = {};
    const props = this._getProps();

    for (let prop of props) {
      const _default = this._propDefinitions[prop]?.default;

      if (_default !== undefined) defaults[prop] = _default;
    }

    return defaults;
  };

  protected _getLinkedMethods = (prop: string): fxLooseObject[] => {
    const methods = this._isSideEffect(prop)
      ? this._propDefinitions[prop]?.onUpdate
      : this._getLinkedUpdates()[prop];

    return methods ?? [];
  };

  protected _getLinkedUpdates = () => {
    const _linkedUpdates: looseObject = {};
    const props = this._getProps();

    for (let prop of props) {
      let _updates = this._propDefinitions[prop]?.onUpdate ?? [];

      _updates = _updates.filter((action) => this._isFunction(action));

      if (_updates?.length) _linkedUpdates[prop] = _updates;
    }

    return _linkedUpdates;
  };

  protected _getProps = () => {
    let props: string[] = Object.keys(this._propDefinitions);

    props = props.filter((prop) => {
      const propDef = this._propDefinitions[prop];

      if (typeof propDef !== "object") return false;

      if (this._isSideEffect(prop)) return false;

      return (
        this._isDependentProp(prop) ||
        this._hasSomeOf(propDef, [
          "default",
          "dependent",
          "readonly",
          "required",
        ]) ||
        this._isLaxProp(prop)
      );
    });

    return this._sort(props);
  };

  protected _getSideEffects = () => {
    let props: string[] = Object.keys(this._propDefinitions);

    props = props.filter((prop) => {
      const propDef = this._propDefinitions[prop];

      if (typeof propDef !== "object") return false;

      return this._isSideEffect(prop);
    });

    return props;
  };

  protected _getValidations = (): looseObject => {
    const validations: looseObject = {};
    const props = this._getProps();

    for (let prop of props) {
      const validator = this._propDefinitions[prop]?.validator;

      if (typeof validator === "function") validations[prop] = validator;
    }

    return validations;
  };

  protected _handleCreateActions = async (data: looseObject = {}) => {
    const actions = this._getCreateActions();

    for (const cb of actions) {
      const extra = await cb(data);

      if (typeof extra !== "object") continue;

      const _props = Object.keys(extra);

      for (let _prop of _props) {
        if (!this._isProp(_prop)) continue;

        const _value = extra[_prop];

        data[_prop] = _value;

        await this._resolveLinkedValue(data, _prop, _value);
      }
    }

    this.context = {};

    return data;
  };

  protected _hasChanged = (prop: string) => {
    const propDef = this._propDefinitions[prop];

    if (!propDef) return false;

    return !isEqual(propDef.default, this._getContext()?.[prop]);
  };

  protected _hasDefault = (prop: string) => {
    const propDef = this._propDefinitions[prop];

    if (!propDef) return false;

    return !isEqual(propDef.default, undefined);
  };

  protected _hasEnoughProps = (): boolean => this._getProps().length > 0;

  protected _hasSomeOf = (obj: looseObject, props: string[]): boolean => {
    for (let prop of props) if (Object(obj).hasOwnProperty(prop)) return true;

    return false;
  };

  protected _isErroneous = () => Object.keys(this.error.payload).length > 0;

  protected _isFunction = (obj: any): boolean => typeof obj === "function";

  protected _isLaxProp = (prop: string): boolean => {
    const propDef = this._propDefinitions[prop];

    if (!propDef) return false;

    if (!this._hasDefault(prop) || this._isDependentProp(prop)) return false;

    const { readonly, required, shouldInit } = propDef;

    if (readonly || required) return false;

    return belongsTo(shouldInit, [true, undefined]);
  };

  protected _isLinkedProp = (prop: string): boolean => {
    let _updates = this._propDefinitions[prop]?.onUpdate ?? [];

    _updates = _updates.filter((action) => this._isFunction(action));

    return _updates.length > 0;
  };

  protected _isProp = (prop: string): boolean =>
    this._getProps().includes(prop);

  protected _isSideEffect = (prop: string): boolean => {
    const propDef = this._propDefinitions[prop];

    if (!propDef) return false;

    const { sideEffect, onUpdate, validator } = propDef;

    if (!this._isFunction(validator)) return false;

    const methods = onUpdate?.filter((method) => this._isFunction(method));

    if (!methods?.length) return false;

    return sideEffect === true;
  };

  protected _isSideInit = (prop: string): boolean => {
    const propDef = this._propDefinitions[prop];

    if (!propDef) return false;

    const { shouldInit } = propDef;

    return this._isSideEffect(prop) && shouldInit !== false;
  };

  protected _isUpdatable = (prop: string) => {
    if (!this._isProp(prop)) return false;

    const readonly = this._propDefinitions[prop]?.readonly;

    return !readonly || (readonly && !this._hasChanged(prop));
  };

  protected _isUpdatableInCTX = (
    prop: string,
    value: any,
    context: looseObject = this._getContext()
  ) => {
    if (!this._isProp(prop)) return false;

    return !isEqual(value, context?.[prop]);
  };

  protected _resolveLinkedValue = async (
    contextObject: looseObject = {},
    prop: string,
    value: any
  ) => {
    const isLinked = this._isLinkedProp(prop),
      isSideEffect = this._isSideEffect(prop);

    if (!isSideEffect && !isLinked) return;

    const { reasons, valid, validated } = await this.validate({
      prop,
      value,
    });

    if (!valid) return this.error.add(prop, reasons);

    const hasChanged = !isEqual(this[prop], validated);

    if (!isSideEffect && !hasChanged) return;

    if (isSideEffect) this.context[prop] = validated;

    const context = { ...this._getContext(), ...contextObject };

    const methods = this._getLinkedMethods(prop);

    for (const cb of methods) {
      const extra = await cb(context);

      if (typeof extra !== "object") continue;

      const _props = Object.keys(extra);

      for (let _prop of _props) {
        const _value = extra[_prop];
        const isSideEffect = this._isSideEffect(_prop);

        if (!isSideEffect && !this._isUpdatableInCTX(_prop, _value, context))
          continue;

        if (!isSideEffect) contextObject[_prop] = _value;

        await this._resolveLinkedValue(contextObject, _prop, _value);
      }
    }
  };

  protected _throwErrors(_message?: string): void {
    let err = new ApiError(this.error.getInfo());

    this.error.clear();

    if (_message) err.setMessage(_message);

    throw err;
  }

  protected _sort = (data: any[]): any[] =>
    data.sort((a, b) => (a < b ? -1 : 1));

  protected _useConfigProps = (obj: looseObject): looseObject => {
    return this._options?.timestamp
      ? { ...obj, createdAt: new Date(), updatedAt: new Date() }
      : obj;
  };

  protected _useSideInitProps = async (obj: looseObject) => {
    const sideEffectProps = this._getSideEffects();

    for (let prop of sideEffectProps) {
      if (!this._isSideInit(prop) || !this.hasOwnProperty(prop)) continue;

      const { reason, valid, validated } = await this.validate({
        prop,
        value: this[prop],
      });

      if (valid) {
        const methods = this._getLinkedMethods(prop);
        const context = this._getContext();

        context[prop] = validated;

        for (const cb of methods) {
          const extra = await cb(context);

          if (typeof extra !== "object") continue;

          Object.keys(extra).forEach((_prop) => {
            if (this._isProp(_prop)) obj[_prop] = extra[_prop];
          });
        }

        continue;
      }

      this.error.add(prop, reason);
    }

    return obj;
  };
}