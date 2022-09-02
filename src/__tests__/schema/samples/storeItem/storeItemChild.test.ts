import { CommonInheritanceTest, commonTestData } from "./common-tests";
import { StoreItemChild } from "./storeItemChild";

const testData = { ...commonTestData, childID: "1" };

CommonInheritanceTest("StoreItemChild", StoreItemChild, testData);

describe("Testing non-inherited properties for StoreItemChild", () => {
  let item: any;

  beforeAll(async () => {
    item = await StoreItemChild(testData).create();
  });

  // creation
  it("should have the correct properties at creation", () => {
    expect(item).toMatchObject({ childID: "1" });
  });

  // updates
  it("should have the correct properties after updates", async () => {
    const update = await StoreItemChild(item).update({
      childID: "12",
      name: "Guiness ",
    });

    expect(update.childID).toBe(undefined);
    expect(update).toMatchObject({ name: "Guiness" });
  });
});
