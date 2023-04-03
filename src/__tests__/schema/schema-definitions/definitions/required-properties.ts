import {
  expectFailure,
  expectNoFailure,
  expectPromiseFailure,
  validator,
} from "../_utils";

export const Test_RequiredProperties = ({ Schema, fx }: any) => {
  describe("required", () => {
    describe("valid", () => {
      it("should allow required + validator", () => {
        const toPass = fx({ propertyName: { required: true, validator } });

        expectNoFailure(toPass);

        toPass();
      });
    });

    describe("invalid", () => {
      it("should reject required & no validator", () => {
        const toFail = fx({ propertyName: { required: true } });

        expectFailure(toFail);

        try {
          toFail();
        } catch (err: any) {
          expect(err.payload).toEqual(
            expect.objectContaining({
              propertyName: expect.arrayContaining([
                "Required properties must have a validator",
              ]),
            })
          );
        }
      });

      it("should reject required(true) + default", () => {
        const toFail = fx({
          propertyName: { default: "", required: true, validator },
        });

        expectFailure(toFail);

        try {
          toFail();
        } catch (err: any) {
          expect(err.payload).toEqual(
            expect.objectContaining({
              propertyName: expect.arrayContaining([
                "Strictly required properties cannot have a default value or setter",
              ]),
            })
          );
        }
      });

      it("should reject required(true) + readonly(true)", () => {
        const values = [false, true];

        for (const readonly of values) {
          const toFail = fx({
            propertyName: { readonly, required: true, validator },
          });

          expectFailure(toFail);

          try {
            toFail();
          } catch (err: any) {
            expect(err.payload).toMatchObject(
              expect.objectContaining({
                propertyName: expect.arrayContaining([
                  "Strictly required properties cannot be readonly",
                ]),
              })
            );
          }
        }
      });

      it("should reject required(true) + shouldInit", () => {
        const values = [false, true, () => "", [], {}];

        for (const shouldInit of values) {
          const toFail = fx({
            propertyName: { required: true, shouldInit, validator },
          });

          expectFailure(toFail);

          try {
            toFail();
          } catch (err: any) {
            expect(err.payload).toMatchObject(
              expect.objectContaining({
                propertyName: expect.arrayContaining([
                  "Required properties cannot have a initialization blocked",
                ]),
              })
            );
          }
        }
      });
    });
  });

  describe("requiredBy", () => {
    describe("valid", () => {
      it("should accept requiredBy + default(any | function)", () => {
        const values = ["", () => ""];

        for (const value of values) {
          const toPass = fx({
            propertyName: {
              default: value,
              required: () => true,
              validator,
            },
          });

          expectNoFailure(toPass);

          toPass();
        }
      });

      it("should accept requiredBy + readonly", () => {
        const toPass = fx({
          propertyName: {
            default: "",
            readonly: true,
            required: () => true,
            validator,
          },
        });

        expectNoFailure(toPass);

        toPass();
      });

      describe("behaviour", () => {
        let Book: any, book: any;

        beforeAll(async () => {
          Book = new Schema(
            {
              bookId: { required: true, validator },
              isPublished: { default: false, validator },
              price: {
                default: null,
                required({ context: { isPublished, price } }: any) {
                  const isRequired = isPublished && price == null;
                  return [isRequired, "A price is required to publish a book!"];
                },
                validator: validatePrice,
              },
              priceReadonly: {
                default: null,
                readonly: true,
                required({ context: { price, priceReadonly } }: any) {
                  const isRequired = price == 101 && priceReadonly == null;
                  return [
                    isRequired,
                    "A priceReadonly is required when price is 101!",
                  ];
                },
                validator: validatePrice,
              },
              priceRequiredWithoutMessage: {
                default: null,
                readonly: true,
                required: ({ context: { price, priceReadonly } }: any) =>
                  price == 101 && priceReadonly == null,
                validator: validatePrice,
              },
            },
            { errors: "throw" }
          ).getModel();

          function validatePrice(price: any) {
            const validated = Number(price),
              valid = !isNaN(price) && validated;
            return { valid, validated };
          }

          book = (await Book.create({ bookId: 1 })).data;
        });

        it("should create normally", () => {
          expect(book).toEqual({
            bookId: 1,
            isPublished: false,
            price: null,
            priceReadonly: null,
            priceRequiredWithoutMessage: null,
          });
        });

        it("should pass if condition is met at creation", async () => {
          const toPass = () =>
            Book.create({ bookId: 1, isPublished: true, price: 2000 });

          expectNoFailure(toPass);

          const { data } = await toPass();

          expect(data).toEqual({
            bookId: 1,
            isPublished: true,
            price: 2000,
            priceReadonly: null,
            priceRequiredWithoutMessage: null,
          });
        });

        it("should reject if condition is not met at creation", async () => {
          const toFail = () => Book.create({ bookId: 1, isPublished: true });

          expectPromiseFailure(toFail, "Validation Error");

          try {
            await toFail();
          } catch (err: any) {
            expect(err.payload).toEqual(
              expect.objectContaining({
                price: expect.arrayContaining([
                  "A price is required to publish a book!",
                ]),
              })
            );
          }
        });

        it("should pass if condition is met during cloning", async () => {
          const toPass = () =>
            Book.clone({ bookId: 1, isPublished: true, price: 2000 });

          expectNoFailure(toPass);

          const { data } = await toPass();

          expect(data).toEqual({
            bookId: 1,
            isPublished: true,
            price: 2000,
            priceReadonly: null,
            priceRequiredWithoutMessage: null,
          });
        });

        it("should reject if condition is not met during cloning", async () => {
          const toFail = () => Book.clone({ bookId: 1, isPublished: true });

          expectPromiseFailure(toFail, "Validation Error");

          try {
            await toFail();
          } catch (err: any) {
            expect(err.payload).toEqual(
              expect.objectContaining({
                price: expect.arrayContaining([
                  "A price is required to publish a book!",
                ]),
              })
            );
          }
        });

        it("should pass if condition is met during updates", async () => {
          const toPass = () =>
            Book.update(
              { bookId: 1, isPublished: false, price: null },
              { isPublished: true, price: 20 }
            );

          expectNoFailure(toPass);

          const { data } = await toPass();

          expect(data).toEqual({ isPublished: true, price: 20 });
        });

        it("should pass if condition is met during updates of readonly", async () => {
          const toPass = () =>
            Book.update(book, { price: 101, priceReadonly: 201 });

          expectNoFailure(toPass);

          const { data } = await toPass();

          expect(data).toEqual({ price: 101, priceReadonly: 201 });
        });

        it("should reject if condition is not met during updates", async () => {
          const toFail = () =>
            Book.update(
              { bookId: 1, isPublished: false, price: null },
              { isPublished: true }
            );

          expectPromiseFailure(toFail, "Validation Error");

          try {
            await toFail();
          } catch (err: any) {
            expect(err.payload).toEqual(
              expect.objectContaining({
                price: expect.arrayContaining([
                  "A price is required to publish a book!",
                ]),
              })
            );
          }
        });

        it("should reject if condition is not met during updates of readonly", async () => {
          const toFail = () => Book.update(book, { price: 101 });

          expectPromiseFailure(toFail, "Validation Error");

          try {
            await toFail();
          } catch (err: any) {
            expect(err.payload).toEqual(
              expect.objectContaining({
                priceReadonly: expect.arrayContaining([
                  "A priceReadonly is required when price is 101!",
                ]),
                priceRequiredWithoutMessage: expect.arrayContaining([
                  "'priceRequiredWithoutMessage' is required!",
                ]),
              })
            );
          }
        });

        it("should not update callable readonly prop that has changed", async () => {
          const toFail = () =>
            Book.update(
              {
                bookId: 1,
                isPublished: false,
                price: null,
                priceReadonly: 201,
                priceRequiredWithoutMessage: null,
              },
              { priceReadonly: 101 }
            );

          expectPromiseFailure(toFail, "Nothing to update");
        });

        describe("behaviour when nothing is returned from required function", () => {
          let Book: any;

          beforeAll(async () => {
            Book = new Schema({
              bookId: { required: true, validator },
              isPublished: { default: false, validator },
              name: { default: "", validator },
              price: {
                default: null,
                required() {},
                validator: validator,
              },
            }).getModel();
          });

          it("should create normally", async () => {
            const { data } = await Book.create({ bookId: 1 });

            expect(data).toEqual({
              bookId: 1,
              isPublished: false,
              name: "",
              price: null,
            });
          });

          it("should clone normally", async () => {
            const book = {
              bookId: 1,
              isPublished: false,
              name: "",
              price: null,
            };
            const { data } = await Book.clone(book);

            expect(data).toEqual(book);
          });

          it("should update normally", async () => {
            const book = {
              bookId: 1,
              isPublished: false,
              name: "",
              price: null,
            };
            const { data } = await Book.update(book, { name: "yooo" });

            expect(data).toEqual({ name: "yooo" });
          });
        });

        describe("behaviour when a non-string value is returned as message from required function", () => {
          const invalidMessages = [
            null,
            undefined,
            [],
            {},
            1,
            0,
            -12,
            () => {},
          ];

          for (const message of invalidMessages) {
            let Book: any;

            beforeAll(async () => {
              Book = new Schema({
                bookId: { required: true, validator },
                isPublished: { default: false, validator },
                name: { default: "", validator },
                price: {
                  default: null,
                  required: () => [true, message],
                  validator: validator,
                },
              }).getModel();
            });

            it("should reject with proper required error message at creation", async () => {
              const { data, error } = await Book.create({ bookId: 1 });

              expect(data).toBeUndefined();

              expect(error).toMatchObject({
                message: "Validation Error",
                payload: { price: ["'price' is required!"] },
              });
            });

            it("should reject with proper required error message during cloning", async () => {
              const book = {
                bookId: 1,
                isPublished: false,
                name: "",
                price: null,
              };
              const { data, error } = await Book.clone(book);

              expect(data).toBeUndefined();

              expect(error).toMatchObject({
                message: "Validation Error",
                payload: { price: ["'price' is required!"] },
              });
            });

            it("should reject with proper required error message during cupdatesloning", async () => {
              const book = {
                bookId: 1,
                isPublished: false,
                name: "",
                price: null,
              };
              const { data, error } = await Book.update(book, { name: "yooo" });

              expect(data).toBeUndefined();

              expect(error).toMatchObject({
                message: "Validation Error",
                payload: { price: ["'price' is required!"] },
              });
            });
          }
        });
      });
    });

    describe("invalid", () => {
      it("should reject requiredBy & no default", () => {
        const toFail = fx({
          propertyName: {
            required: () => true,
            validator,
          },
        });

        expectFailure(toFail);

        try {
          toFail();
        } catch (err: any) {
          expect(err.payload).toMatchObject(
            expect.objectContaining({
              propertyName: expect.arrayContaining([
                "Callable required properties must have a default value or setter",
              ]),
            })
          );
        }
      });

      it("should reject requiredBy + default & dependent(true)", () => {
        const toFail = fx({
          dependentProp: {
            default: "value",
            dependent: true,
            dependsOn: "prop",
            resolver: () => 1,
            required: () => true,
            validator,
          },
          prop: { default: "" },
        });

        expectFailure(toFail);

        try {
          toFail();
        } catch (err: any) {
          expect(err.payload).toMatchObject(
            expect.objectContaining({
              dependentProp: expect.arrayContaining([
                "Required properties cannot be dependent",
              ]),
            })
          );
        }
      });

      it("should reject required(true) + shouldInit", () => {
        const values = [false, true, () => "", [], {}];

        for (const shouldInit of values) {
          const toFail = fx({
            propertyName: {
              default: "",
              required: () => true,
              shouldInit,
              validator,
            },
          });

          expectFailure(toFail);

          try {
            toFail();
          } catch (err: any) {
            expect(err.payload).toMatchObject(
              expect.objectContaining({
                propertyName: expect.arrayContaining([
                  "Required properties cannot have a initialization blocked",
                ]),
              })
            );
          }
        }
      });
    });
  });
};