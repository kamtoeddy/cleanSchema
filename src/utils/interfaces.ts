export interface IArrayOptions<T> {
  empty?: boolean;
  filter?: (data: T) => boolean;
  modifier?: (data: T) => any;
  sorted?: boolean;
  sorter?: (a: T, b: T) => number;
  sortOrder?: "asc" | "desc";
  unique?: boolean;
  uniqueKey?: string;
}
export type PayloadKey = number | string;

export type ErrorPayload = Record<PayloadKey, string[]>;
export type InputPayload = Record<PayloadKey, string | string[]>;

export interface ApiErrorProps {
  message: string;
  payload?: InputPayload;
  statusCode?: number;
}

export type ObjectType = Record<number | string, any>;

export interface NumberRangeType {
  bounds: number[];
  inclusiveBottom?: boolean;
  inclusiveTop?: boolean;
}

export interface IStringOptions {
  enums?: string[];
  maxLength?: number;
  minLength?: number;
  regExp?: RegExp;
}
