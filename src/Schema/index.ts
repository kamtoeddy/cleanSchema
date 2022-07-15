import { looseObject } from "../utils/interfaces";
import { isEqual } from "../utils/isEqual";
import {
  extensionOptions,
  ICloneOptions,
  IModel,
  IValidateProps,
  options,
  propDefinitionType,
} from "./interfaces";
import { SchemaCore } from "./SchemaCore";

export class Schema extends SchemaCore {
  constructor(
    propDefinitions: propDefinitionType,
    options: options = { timestamp: false }
  ) {
    super(propDefinitions, options);
  }

  private _useExtensionOptions = (options: extensionOptions) => {
    const { remove } = options;

    remove?.forEach((prop) => delete this._propDefinitions?.[prop]);
  };

  extend = (parent: Schema, options: extensionOptions = { remove: [] }) => {
    this._propDefinitions = {
      ...parent.getPropDefinitions,
      ...this._propDefinitions,
    };

    this._useExtensionOptions(options);

    return this;
  };
}

class Model extends SchemaCore implements IModel {
  constructor(schema: Schema, values: Record<string, any>) {
    super(schema.getPropDefinitions, schema.getOptions);
    this.setValues(values);
  }

  static build(schema: Schema) {
    return function Builder(values: Record<string, any>) {
      return new Model(schema, values);
    };
  }

  private setValues(values: Record<string, any>) {
    Object.keys(values).forEach((key) => {
      if (this._isProp(key)) this[key] = values[key];
    });
  }

  clone = async (options: ICloneOptions = { toReset: [] }) => {
    const { toReset } = options;

    const cloned = await this._getCloneObject(toReset);

    return this._handleCreateActions(cloned);
  };

  create = async () => {
    let obj = await this._getCreateObject();

    if (this._isErroneous()) this._throwErrors();

    return this._handleCreateActions(obj);
  };

  validate = async ({ prop = "", value }: IValidateProps) => {
    const isSideEffect = this._isSideEffect(prop);

    if (!this._isProp(prop) && !isSideEffect)
      return { valid: false, reasons: ["Invalid property"] };

    const validator = isSideEffect
      ? this._propDefinitions[prop].validator
      : this._getValidations()[prop];

    if (!validator && isEqual(value, "undefined")) {
      return { valid: false, reasons: ["Invalid value"] };
    }

    if (validator) return validator(value, this._getContext());

    return { reasons: [""], valid: true, validated: value };
  };

  update = async (changes: Record<string, any>) => {
    this.updated = {};

    const toUpdate = Object.keys(changes ?? {});

    // iterate through validated values and get only changed fields
    // amongst the schema's updatable properties
    const updatables = toUpdate.filter((prop) => this._isUpdatable(prop));
    const linkedOrSideEffects = toUpdate.filter(
      (prop) =>
        !this._isDependentProp(prop) &&
        (this._isLinkedProp(prop) || this._isSideEffect(prop))
    );

    for (let prop of updatables) {
      const { reasons, valid, validated } = await this.validate({
        prop,
        value: changes[prop],
      });

      if (!valid) {
        this.error.add(prop, reasons);
        continue;
      }

      const hasChanged = !isEqual(this[prop], validated);

      if (valid && hasChanged) {
        this.updated[prop] = validated;
        continue;
      }
    }

    for (let prop of linkedOrSideEffects)
      await this._resolveLinkedValue(this.updated, prop, changes[prop]);

    if (this._isErroneous()) this._throwErrors();

    // get the number of properties updated
    // and deny update if none was modified
    const updatedKeys = this._sort(Object.keys(this.updated));
    if (!updatedKeys.length) this._throwErrors("Nothing to update");

    const updated: looseObject = { ...this.updated };

    this.context = {};
    this.updated = {};

    updatedKeys.forEach((key: string) => (this.updated[key] = updated[key]));

    if (this.getOptions?.timestamp) this.updated.updatedAt = new Date();

    return this.updated;
  };
}

export const makeModel = Model.build;