import { expectFailure, expectNoFailure, pauseFor } from "../_utils";

export const Test_ConstantProperties = ({ Schema, fx }: any) => {
  describe("constant", () => {
    describe("valid", () => {
      let User: any, user: any;

      beforeAll(async () => {
        User = new Schema(
          {
            asyncConstant: { constant: true, value: asyncSetter },
            id: {
              constant: true,
              value: (ctx: any) => (ctx?.id === "id" ? "id-2" : "id"),
            },
            parentId: { constant: true, value: "parent id" },
            laxProp: { default: 0 },
          },
          { errors: "throw" }
        ).getModel();

        async function asyncSetter() {
          await pauseFor(5);

          return 20;
        }

        user = (await User.create({ id: 2, parentId: [], laxProp: 2 })).data;
      });

      it("should set constants at creation", () => {
        expect(user).toEqual({
          asyncConstant: 20,
          id: "id",
          parentId: "parent id",
          laxProp: 2,
        });
      });

      it("should set constants during cloning", async () => {
        const { data: clone } = await User.clone(user, { reset: "laxProp" });

        expect(clone).toEqual({
          asyncConstant: 20,
          id: "id-2",
          parentId: "parent id",
          laxProp: 0,
        });
      });

      it("should not set constants via listeners", async () => {
        const { data: update } = await User.update(user, {
          laxProp: "update id",
        });

        expect(update).toEqual({ laxProp: "update id" });
      });

      it("should ignore constants during updates", () => {
        const toFail = User.update(user, { id: 25 });

        expect(toFail).rejects.toThrow("Nothing to update");
      });

      it("should accept constant(true) & value(any | ()=>any)", () => {
        const values = ["", "value", 1, null, false, true, {}, [], () => 1];

        for (const value of values) {
          const toPass = fx({ propertyName: { constant: true, value } });

          expectNoFailure(toPass);

          toPass();
        }
      });

      it("should accept constant & value + onDelete(function | function[])", () => {
        const values = [() => ({}), [() => ({})], [() => ({}), () => ({})]];

        for (const onDelete of values) {
          const toPass = fx({
            propertyName: { constant: true, value: "", onDelete },
          });

          expectNoFailure(toPass);

          toPass();
        }
      });

      it("should accept constant & value + onSuccess(function | function[])", () => {
        const values = [() => ({}), [() => ({})], [() => ({}), () => ({})]];

        for (const onSuccess of values) {
          const toPass = fx({
            propertyName: { constant: true, value: "", onSuccess },
          });

          expectNoFailure(toPass);

          toPass();
        }
      });
    });

    describe("invalid", () => {
      it("should reject constant(!true)", () => {
        const values = [1, "", null, undefined, false, {}, []];

        for (const value of values) {
          const toFail = fx({
            propertyName: { constant: value, value: "" },
          });

          expectFailure(toFail);

          try {
            toFail();
          } catch (err: any) {
            expect(err.payload).toEqual(
              expect.objectContaining({
                propertyName: expect.arrayContaining([
                  "Constant properties must have constant as 'true'",
                ]),
              })
            );
          }
        }
      });

      it("should reject constant & no value", () => {
        const toFail = fx({ propertyName: { constant: true } });

        expectFailure(toFail);

        try {
          toFail();
        } catch (err: any) {
          expect(err.payload).toEqual(
            expect.objectContaining({
              propertyName: expect.arrayContaining([
                "Constant properties must have a value or setter",
              ]),
            })
          );
        }
      });

      it("should reject 'value' on non-constants", () => {
        const toFail = fx({ propertyName: { value: true } });

        expectFailure(toFail);

        try {
          toFail();
        } catch (err: any) {
          expect(err.payload).toEqual(
            expect.objectContaining({
              propertyName: expect.arrayContaining([
                "'value' rule can only be used with constant properties",
              ]),
            })
          );
        }
      });

      it("should reject constant & value(undefined)", () => {
        const toFail = fx({
          propertyName: { constant: true, value: undefined },
        });

        expectFailure(toFail);

        try {
          toFail();
        } catch (err: any) {
          expect(err.payload).toEqual(
            expect.objectContaining({
              propertyName: expect.arrayContaining([
                "Constant properties cannot have 'undefined' as value",
              ]),
            })
          );
        }
      });

      it("should reject (constant & value) + any other rule(!onCreate)", () => {
        const rules = [
          "default",
          "dependent",
          "dependsOn",
          "onFailure",
          "readonly",
          "resolver",
          "required",
          "sanitizer",
          "shouldInit",
          "validator",
          "virtual",
        ];

        for (const rule of rules) {
          const toFail = fx({
            propertyName: { constant: true, value: "", [rule]: true },
          });

          expectFailure(toFail);

          try {
            toFail();
          } catch (err: any) {
            expect(err.payload).toEqual(
              expect.objectContaining({
                propertyName: expect.arrayContaining([
                  "Constant properties can only have ('constant' & 'value') or 'onDelete' | 'onSuccess'",
                ]),
              })
            );
          }
        }
      });
    });
  });
};