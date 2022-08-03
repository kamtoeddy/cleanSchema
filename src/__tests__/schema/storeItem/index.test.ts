import { StoreItem } from ".";
import { IOtherQuantity, IStoreItem } from "./interfaces";

describe("Testing schema of StoreItem", () => {
  let storeItem: IStoreItem;

  beforeAll(async () => {
    storeItem = await StoreItem({
      id: "1",
      name: "beer",
      price: 5,
      measureUnit: "bottle",
      otherMeasureUnits: [
        { coefficient: 12, name: "crate" },
        { coefficient: 24, name: "crate24" },
        { coefficient: 5, name: "tray" },
      ],
      quantity: 100,
      quantities: [{ quantity: 1, name: "crate24" }],
    }).create();

    console.log("storeItem:", storeItem);
  });

  it("should have been created properly", () => {
    expect(storeItem).toMatchObject<IStoreItem>({
      id: "1",
      name: "beer",
      price: 5,
      measureUnit: "bottle",
      quantity: 124,
    });
  });

  it("should update the relevant properties", async () => {
    const update = await StoreItem(storeItem).update({
      name: "Castel",
    });

    expect(update).toMatchObject({ name: "Castel" });
  });
});