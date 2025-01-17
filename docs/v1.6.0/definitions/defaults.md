## Default Values

Setting the default value of a given property can be done by:

- Populating the default field of the property's definition like `favoriteColor`
- Providing a synchronous function to provide a value at runtime

  > **`undefined`** is used as default value for all properties out of the box.

Example:

```ts
import { Schema, type MutableContext } from 'ivo';

const userSchema = new Schema({
  favoriteColor: { default: 'indigo', validator: validateColor },
  userName: {
    default: (ctx: MutableContext) => '',
    validator: validateUserName,
  },
});
```

> N.B: if the default value of a property is to be generated by a function and this function happens to throw an error, the value of the property will be `null`